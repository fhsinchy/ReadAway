/**
 * ImportService
 *
 * Validates EPUB source (Standard Ebooks / Project Gutenberg only),
 * generates book identity (syncKey, editionHash),
 * and extracts metadata (title, author, cover, language).
 */

import { unzipSync, strFromU8 } from 'fflate'
import type { BookSource, EpubMetadata, ImportResult } from '@/types'
import { db } from '@/db'
import { storeEpub } from './BookStorageService'

// ============================================================
// Public API
// ============================================================

/**
 * Import an EPUB file. Validates source, extracts metadata,
 * stores the file, and persists the book record.
 */
export async function importEpub(file: File): Promise<ImportResult> {
  // 1. Read file bytes
  let epubBytes: ArrayBuffer
  try {
    epubBytes = await file.arrayBuffer()
  } catch {
    return { success: false, error: 'invalid_epub' }
  }

  // 2. Unzip and find OPF
  let opfXml: string
  try {
    opfXml = extractOpfXml(new Uint8Array(epubBytes))
  } catch {
    return { success: false, error: 'invalid_epub' }
  }

  // 3. Parse OPF metadata
  let meta: EpubMetadata
  try {
    meta = parseMetadata(opfXml)
  } catch {
    return { success: false, error: 'parse_error' }
  }

  // 4. Validate source
  const source = detectSource(meta, opfXml)
  if (!source) {
    return { success: false, error: 'unsupported_source' }
  }

  // 5. Generate identities
  const sourceId = extractSourceId(opfXml, source)
  const syncKey = `${source}:${sourceId}`
  const editionHash = await computeSha256(epubBytes)

  // 6. Store EPUB
  const storageKey = `${syncKey.replace(/[^a-zA-Z0-9_-]/g, '_')}.epub`
  await storeEpub(storageKey, epubBytes)

  // 7. Extract cover image — search for cover files directly, no OPF parsing
  const coverPath = extractCoverFromEpub(new Uint8Array(epubBytes))

  // 8. Create book record
  const book = {
    syncKey,
    source,
    sourceId,
    editionHash,
    title: meta.title,
    author: meta.author,
    language: meta.language,
    coverPath,
    storageKey,
    importedAt: Date.now(),
  }

  await db.books.put(book)

  return { success: true, book }
}

// ============================================================
// Source detection
// ============================================================

/**
 * Detect the book source by checking multiple OPF metadata fields.
 * Order: publisher → identifier → source → rights → full OPF scan
 */
function detectSource(meta: EpubMetadata, opfXml: string): BookSource | null {
  // Combine all searchable text
  const fields = [
    meta.publisher,
    meta.identifier,
    meta.source,
    meta.rights,
  ].filter(Boolean)

  const combined = fields.join(' ')

  // Check for Standard Ebooks first (more specific patterns)
  if (
    /standard\s*ebooks/i.test(combined) ||
    /standardebooks\.org/i.test(combined)
  ) {
    return 'standardebooks'
  }

  // Check for Project Gutenberg
  if (
    /project\s*gutenberg/i.test(combined) ||
    /gutenberg\.org/i.test(combined) ||
    /gutenberg\.net/i.test(combined) ||
    /pg\d{3,6}/i.test(combined)
  ) {
    return 'gutenberg'
  }

  // Fallback: scan the full OPF for gutenberg.org URLs
  if (/gutenberg\.org/i.test(opfXml)) {
    return 'gutenberg'
  }

  // Fallback: scan the full OPF for standardebooks.org URLs
  if (/standardebooks\.org/i.test(opfXml)) {
    return 'standardebooks'
  }

  return null
}

// ============================================================
// EPUB parsing
// ============================================================

/**
 * Unzip the EPUB and extract the OPF XML content.
 */
function extractOpfXml(epubData: Uint8Array): string {
  const unzipped = unzipSync(epubData)

  // Read META-INF/container.xml to find OPF path
  const containerPath = 'META-INF/container.xml'
  const containerBytes = unzipped[containerPath]
  if (!containerBytes) {
    throw new Error('Invalid EPUB: missing container.xml')
  }

  const containerXml = strFromU8(containerBytes)
  const opfPath = extractOpfPath(containerXml)
  if (!opfPath) {
    throw new Error('Invalid EPUB: could not find OPF path')
  }

  // OPF path may be relative — try exact match first, then search
  let opfBytes = unzipped[opfPath]
  if (!opfBytes) {
    // Try without leading directory
    const filename = opfPath.split('/').pop()!
    const key = Object.keys(unzipped).find(k => k.endsWith(filename))
    if (key) opfBytes = unzipped[key]
  }
  if (!opfBytes) {
    throw new Error('Invalid EPUB: OPF file not found')
  }

  return strFromU8(opfBytes)
}

function extractOpfPath(containerXml: string): string | null {
  const match = containerXml.match(/full-path="([^"]+)"/i)
  return match ? match[1] : null
}

// ============================================================
// Metadata parsing
// ============================================================

function parseMetadata(opfXml: string): EpubMetadata {
  const getTag = (tag: string): string => {
    const match = opfXml.match(
      new RegExp(`<dc:${tag}[^>]*>([^<]*)<\\/dc:${tag}>`, 'i'),
    )
    return match ? match[1].trim() : ''
  }

  const title = getTag('title')
  const author = getTag('creator')
  const language = getTag('language')
  const publisher = getTag('publisher')
  const identifier = getTag('identifier')
  const source = getTag('source')
  const rights = getTag('rights')

  return {
    title: title || 'Unknown Title',
    author: author || 'Unknown Author',
    language: language || 'en',
    publisher,
    identifier,
    source,
    rights,
  }
}

// ============================================================
// Source ID extraction
// ============================================================

function extractSourceId(opfXml: string, source: BookSource): string {
  if (source === 'standardebooks') {
    // Standard Ebooks uses URLs like: https://standardebooks.org/ebooks/bram-stoker/dracula
    const seMatch = opfXml.match(
      /standardebooks\.org\/ebooks\/([^<\s"]+)/i,
    )
    if (seMatch) return seMatch[1]

    // Fallback: use the dc:identifier
    const idMatch = opfXml.match(
      /<dc:identifier[^>]*>([^<]+)<\/dc:identifier>/i,
    )
    if (idMatch) {
      // Extract the last path segment
      const id = idMatch[1].trim()
      const parts = id.replace(/^https?:\/\/[^/]+\//, '').split('/')
      return parts.slice(-2).join('/')
    }
    return 'unknown'
  }

  if (source === 'gutenberg') {
    // Project Gutenberg: ebook number embedded in identifier or source URL
    // Patterns: http://www.gutenberg.org/10007, pg10007, or just 10007
    
    // Try extracting number from gutenberg.org/ebooks/NNNN or gutenberg.org/NNNN
    const urlMatch = opfXml.match(/gutenberg\.org\/(?:ebooks\/)?(\d+)/i)
    if (urlMatch) return urlMatch[1]

    // Try pgNNNNN pattern
    const pgMatch = opfXml.match(/pg(\d+)/i)
    if (pgMatch) return pgMatch[1]

    // Fallback: any numeric identifier as last resort
    const idMatch = opfXml.match(
      /<dc:identifier[^>]*>[^<]*(\d{4,})[^<]*<\/dc:identifier>/i,
    )
    if (idMatch) return idMatch[1]

    return 'unknown'
  }

  return 'unknown'
}

// ============================================================
// Cover extraction — simple file search, no OPF parsing
// ============================================================

/**
 * Find the cover image by searching the unzipped EPUB for common cover filenames.
 * Standard Ebooks: always images/cover.jpg
 * Project Gutenberg: cover image in OEBPS/ with "cover" in the name
 */
function extractCoverFromEpub(epubData: Uint8Array): string | null {
  try {
    const unzipped = unzipSync(epubData)
    const keys = Object.keys(unzipped)

    // Priority 1: exact path "images/cover.jpg" (Standard Ebooks convention)
    let key = keys.find(
      k => k.endsWith('/images/cover.jpg') || k === 'images/cover.jpg',
    )

    // Priority 2: any file with "cover" in the filename (image extensions)
    if (!key) {
      key = keys.find(k => {
        const lower = k.toLowerCase()
        return (
          lower.includes('cover') &&
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(k)
        )
      })
    }

    if (!key) return null

    const bytes = unzipped[key]
    const ext = key.split('.').pop()?.toLowerCase()
    const mime =
      ext === 'png' ? 'image/png'
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : ext === 'svg' ? 'image/svg+xml'
      : 'image/jpeg'

    const base64 = uint8ToBase64(bytes)
    return `data:${mime};base64,${base64}`
  } catch {
    return null
  }
}

// ============================================================
// Utilities
// ============================================================

async function computeSha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
