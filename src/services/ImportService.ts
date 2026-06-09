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

    // Priority 1: "images/cover.jpg" (Standard Ebooks)
    let key = keys.find(
      k => k.endsWith('/images/cover.jpg') || k === 'images/cover.jpg',
    )

    // Priority 2: "*_cover.jpg" (Project Gutenberg)
    if (!key) {
      key = keys.find(k => k.endsWith('_cover.jpg'))
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
  let hashBuffer: ArrayBuffer
  if (globalThis.crypto?.subtle) {
    hashBuffer = await crypto.subtle.digest('SHA-256', data)
  } else {
    hashBuffer = await jsSha256(data)
  }
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Pure JS SHA-256 fallback for insecure contexts (e.g. dev server
 * accessed from a phone on the host network via HTTP).
 * Uses the SubtleCrypto API when available.
 */
async function jsSha256(data: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(data)
  // SHA-256 constants: first 32 bits of fractional parts of cube roots
  // of the first 64 primes
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])

  // Initial hash values: first 32 bits of fractional parts of square
  // roots of the first 8 primes
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])

  // Pre-processing: padding
  const msgLen = bytes.length
  const bitLen = msgLen * 8
  // Padding: 1 bit, then zeros, then 64-bit length in big-endian
  const padLen = (56 - ((msgLen + 1) % 64) + 64) % 64
  const totalLen = msgLen + 1 + padLen + 8
  const padded = new Uint8Array(totalLen)
  padded.set(bytes)
  padded[msgLen] = 0x80
  // Append length as 64-bit big-endian
  const view = new DataView(padded.buffer)
  view.setUint32(totalLen - 4, bitLen >>> 0, false) // low 32 bits
  // bitLen could exceed 32 bits for files > 512MB — safe for EPUBs

  // Process each 512-bit (64-byte) chunk
  for (let offset = 0; offset < totalLen; offset += 64) {
    const W = new Uint32Array(64)
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false)
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rightRotate(W[i - 15], 7) ^ rightRotate(W[i - 15], 18) ^ (W[i - 15] >>> 3))
      const s1 = (rightRotate(W[i - 2], 17) ^ rightRotate(W[i - 2], 19) ^ (W[i - 2] >>> 10))
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0
      const S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0

      h = g; g = f; f = e; e = (d + temp1) >>> 0
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }

  // Produce final hash value
  const result = new Uint8Array(32)
  const resultView = new DataView(result.buffer)
  for (let i = 0; i < 8; i++) {
    resultView.setUint32(i * 4, H[i], false)
  }
  return result.buffer
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount))
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
