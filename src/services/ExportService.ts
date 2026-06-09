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
  ArchiveProgressEntry,
  Book,
  Progress,
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

    const progress = await db.progress.get(syncKey)
    const hasProgress = !!progress

    const entry: ArchiveBookEntry = {
      syncKey: book.syncKey,
      source: book.source,
      sourceId: book.sourceId,
      editionHash: book.editionHash,
      title: book.title,
      author: book.author,
      filename,
      hasProgress,
      importedAt: book.importedAt,
      progressPercentage: progress?.percentage,
      progressUpdatedAt: progress?.updatedAt,
    }

    manifest.books.push(entry)

    // Include progress in a sidecar file
    if (progress) {
      files[progressPath(entry)] = strToU8(
        JSON.stringify({
          syncKey: progress.syncKey,
          editionHash: book.editionHash,
          locator: progress.locator,
          percentage: progress.percentage,
          updatedAt: progress.updatedAt,
        }),
      )
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

export type RestoreStatus =
  | 'new'
  | 'archive_newer'
  | 'local_newer'
  | 'same_progress'
  | 'archive_no_progress'

export interface RestorePreviewItem {
  entry: ArchiveBookEntry
  localBook: Book | null
  localProgress: Progress | null
  archiveProgress: ArchiveProgressEntry | null
  editionMismatch: boolean
  defaultSelected: boolean
  status: RestoreStatus
}

export interface RestorePreview {
  manifest: ArchiveManifest
  items: RestorePreviewItem[]
}

/**
 * Parse a .raway archive and compare each snapshot to local state.
 */
export async function previewRestore(file: File): Promise<RestorePreview> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const unzipped = unzipSync(bytes)
  const manifest = parseManifest(unzipped)

  const items = await Promise.all(
    manifest.books.map(async (entry): Promise<RestorePreviewItem> => {
      const [localBook, localProgress] = await Promise.all([
        db.books.get(entry.syncKey),
        db.progress.get(entry.syncKey),
      ])
      const archiveProgress = readProgress(unzipped, entry)
      const localProgressTime = localProgress?.updatedAt ?? 0
      const archiveProgressTime = archiveProgress?.updatedAt ?? 0
      const editionMismatch = Boolean(
        localBook &&
          entry.editionHash &&
          localBook.editionHash !== entry.editionHash,
      )

      let status: RestoreStatus
      if (!localBook) {
        status = 'new'
      } else if (!archiveProgress && localProgress) {
        status = 'archive_no_progress'
      } else if (localProgressTime > archiveProgressTime) {
        status = 'local_newer'
      } else if (archiveProgressTime > localProgressTime) {
        status = 'archive_newer'
      } else {
        status = 'same_progress'
      }

      return {
        entry,
        localBook: localBook ?? null,
        localProgress: localProgress ?? null,
        archiveProgress,
        editionMismatch,
        defaultSelected:
          status !== 'local_newer' && status !== 'archive_no_progress',
        status,
      }
    }),
  )

  return { manifest, items }
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

  const manifest = parseManifest(unzipped)

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
    const epubFile = new File([epubBytes], entry.filename, {
      type: 'application/epub+zip',
    })

    const result = await importEpub(epubFile)
    if (result.success) {
      if (entry.importedAt) {
        await db.books.update(entry.syncKey, { importedAt: entry.importedAt })
      }

      // Restore this snapshot's progress. If the snapshot has no progress,
      // selected restore means the local progress is removed too.
      const progressData = readProgress(unzipped, entry)
      if (progressData) {
        await db.progress.put({
          syncKey: entry.syncKey,
          locator: progressData.locator,
          percentage: progressData.percentage,
          updatedAt: progressData.updatedAt,
        })
      } else {
        await db.progress.delete(entry.syncKey)
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

function parseManifest(unzipped: Record<string, Uint8Array>): ArchiveManifest {
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

function readProgress(
  unzipped: Record<string, Uint8Array>,
  entry: ArchiveBookEntry,
): ArchiveProgressEntry | null {
  const progressBytes =
    unzipped[progressPath(entry)] ??
    unzipped[`books/${sanitizeFilename(entry.title)}.progress.json`]

  if (!progressBytes) return null

  try {
    const progressData = JSON.parse(strFromU8(progressBytes))
    if (
      typeof progressData.locator !== 'string' ||
      typeof progressData.percentage !== 'number'
    ) {
      return null
    }

    return {
      syncKey: entry.syncKey,
      editionHash:
        typeof progressData.editionHash === 'string'
          ? progressData.editionHash
          : entry.editionHash,
      locator: progressData.locator,
      percentage: progressData.percentage,
      updatedAt:
        typeof progressData.updatedAt === 'number'
          ? progressData.updatedAt
          : entry.progressUpdatedAt ?? 0,
    }
  } catch {
    return null
  }
}

function progressPath(entry: ArchiveBookEntry): string {
  return `progress/${sanitizeSyncKey(entry.syncKey)}.json`
}

function sanitizeSyncKey(syncKey: string): string {
  return syncKey.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100)
}
