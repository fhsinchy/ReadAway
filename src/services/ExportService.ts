/**
 * ExportService
 *
 * Generates and imports .raway archive files.
 * Archive format: ZIP containing manifest.json and books/ directory.
 */

import { zipSync, unzipSync, strFromU8, strToU8 } from 'fflate'
import type {
  ArchiveManifest,
  ArchiveBookEntry,
  ExportOptions,
} from '@/types'
import { db } from '@/db'
import { getEpub } from './BookStorageService'
import { importEpub } from './ImportService'

// ============================================================
// Export
// ============================================================

/**
 * Generate a .raway archive for the given books.
 */
export async function exportArchive(
  syncKeys: string[],
  options: ExportOptions,
): Promise<Blob> {
  const manifest: ArchiveManifest = {
    version: 1,
    exportedAt: Date.now(),
    books: [],
  }

  const files: Record<string, Uint8Array> = {}

  for (const syncKey of syncKeys) {
    const book = await db.books.get(syncKey)
    if (!book) continue

    const epubBytes = await getEpub(book.storageKey)
    if (!epubBytes) continue

    const safeFilename = sanitizeFilename(book.title)
    const filename = `${safeFilename}.epub`

    files[`books/${filename}`] = new Uint8Array(epubBytes)

    let hasProgress = false
    if (options.includeProgress) {
      const progress = await db.progress.get(syncKey)
      hasProgress = !!progress
    }

    const entry: ArchiveBookEntry = {
      syncKey: book.syncKey,
      source: book.source,
      sourceId: book.sourceId,
      title: book.title,
      author: book.author,
      filename,
      hasProgress,
    }

    manifest.books.push(entry)

    // Include progress in a sidecar file
    if (options.includeProgress) {
      const progress = await db.progress.get(syncKey)
      if (progress) {
        files[`books/${safeFilename}.progress.json`] = strToU8(
          JSON.stringify({
            syncKey: progress.syncKey,
            locator: progress.locator,
            percentage: progress.percentage,
          }),
        )
      }
    }
  }

  // Add manifest
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

  // Create ZIP
  const zipped = zipSync(files, { level: 6 })
  return new Blob([zipped], { type: 'application/zip' })
}

// ============================================================
// Import
// ============================================================

export interface ArchivePreview {
  manifest: ArchiveManifest
  selectedKeys: Set<string>
}

/**
 * Parse a .raway archive and return its manifest for preview.
 */
export async function previewArchive(file: File): Promise<ArchiveManifest> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const unzipped = unzipSync(bytes)

  const manifestBytes = unzipped['manifest.json']
  if (!manifestBytes) {
    throw new Error('Invalid archive: missing manifest.json')
  }

  const manifest: ArchiveManifest = JSON.parse(strFromU8(manifestBytes))
  if (!manifest.version || !Array.isArray(manifest.books)) {
    throw new Error('Invalid archive: malformed manifest')
  }

  return manifest
}

/**
 * Import books from a parsed archive.
 */
export async function importFromArchive(
  file: File,
  selectedKeys: Set<string>,
): Promise<{ imported: number; skipped: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const unzipped = unzipSync(bytes)

  const manifest = await previewArchive(file)

  let imported = 0
  let skipped = 0

  for (const entry of manifest.books) {
    if (!selectedKeys.has(entry.syncKey)) continue

    const epubBytes = unzipped[`books/${entry.filename}`]
    if (!epubBytes) {
      skipped++
      continue
    }

    // Convert to a File for the import service
    const epubFile = new File([epubBytes.buffer], entry.filename, {
      type: 'application/epub+zip',
    })

    const result = await importEpub(epubFile)
    if (result.success) {
      // Restore progress if available
      const safeName = sanitizeFilename(entry.title)
      const progressBytes = unzipped[`books/${safeName}.progress.json`]
      if (progressBytes) {
        try {
          const progressData = JSON.parse(strFromU8(progressBytes))
          await db.progress.put({
            syncKey: entry.syncKey,
            locator: progressData.locator,
            percentage: progressData.percentage,
            updatedAt: Date.now(),
          })
        } catch {
          // Progress restoration is best-effort
        }
      }
      imported++
    } else {
      skipped++
    }
  }

  return { imported, skipped }
}

// ============================================================
// Helpers
// ============================================================

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100)
}
