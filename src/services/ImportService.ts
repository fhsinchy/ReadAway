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
  const source = detectSource(meta.publisher)
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

  // 7. Extract cover image and store reference
  let coverPath: string | null = null
  if (meta.coverHref) {
    coverPath = await extractCover(new Uint8Array(epubBytes), meta.coverHref)
  }

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

const STANDARDEBOOKS_PATTERNS = [
  /standard\s*ebooks/i,
  /standardebooks/i,
]

const GUTENBERG_PATTERNS = [
  /project\s*gutenberg/i,
  /gutenberg/i,
]

function detectSource(publisher: string): BookSource | null {
  for (const pattern of STANDARDEBOOKS_PATTERNS) {
    if (pattern.test(publisher)) return 'standardebooks'
  }
  for (const pattern of GUTENBERG_PATTERNS) {
    if (pattern.test(publisher)) return 'gutenberg'
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

  // Find cover image reference
  let coverHref: string | null = null
  const coverMatch = opfXml.match(
    /<meta[^>]*name="cover"[^>]*content="([^"]*)"[^>]*\/?>/i,
  )
  if (coverMatch) {
    const coverId = coverMatch[1]
    const itemMatch = opfXml.match(
      new RegExp(
        `<item[^>]*id="${escapeRegExp(coverId)}"[^>]*href="([^"]*)"[^>]*\\/?>`,
        'i',
      ),
    )
    if (itemMatch) coverHref = itemMatch[1]
  }

  return {
    title: title || 'Unknown Title',
    author: author || 'Unknown Author',
    language: language || 'en',
    coverHref,
    publisher,
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
    // Project Gutenberg: ebook number in identifier like "10007" or "pg10007"
    const pgMatch = opfXml.match(/pg(\d+)/i)
    if (pgMatch) return pgMatch[1]

    const idMatch = opfXml.match(
      /<dc:identifier[^>]*>(\d+)<\/dc:identifier>/i,
    )
    if (idMatch) return idMatch[1]

    return 'unknown'
  }

  return 'unknown'
}

// ============================================================
// Cover extraction
// ============================================================

async function extractCover(
  epubData: Uint8Array,
  coverHref: string,
): Promise<string | null> {
  try {
    const unzipped = unzipSync(epubData)

    // Find the cover file
    let coverBytes: Uint8Array | undefined
    const filename = coverHref.split('/').pop()!
    const key = Object.keys(unzipped).find(k => k.endsWith(filename))
    if (key) coverBytes = unzipped[key]

    if (!coverBytes) return null

    // Store as data URL in the books table (covers are small)
    const mime = getMimeType(filename)
    const base64 = uint8ToBase64(coverBytes)
    return `data:${mime};base64,${base64}`
  } catch {
    return null
  }
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'image/jpeg'
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

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
