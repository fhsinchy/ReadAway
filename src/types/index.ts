// ============================================================
// Book identity
// ============================================================

export type BookSource = 'standardebooks' | 'gutenberg'

export interface Book {
  syncKey: string
  source: BookSource
  sourceId: string
  editionHash: string
  title: string
  author: string
  language: string
  coverPath: string | null
  storageKey: string
  importedAt: number
}

// ============================================================
// Reading progress
// ============================================================

export interface Progress {
  syncKey: string
  locator: string // epub.js locator serialized as JSON
  percentage: number
  updatedAt: number
}

// ============================================================
// Stable page maps
// ============================================================

export interface PageMap {
  key: string
  syncKey: string
  editionHash: string
  algorithmVersion: number
  charsPerPage: number
  locations: string
  createdAt: number
  updatedAt: number
}

// ============================================================
// Themes
// ============================================================

export type Theme = 'light' | 'dark' | 'black'

export const THEME_VALUES: Record<Theme, { bg: string; label: string }> = {
  light: { bg: '#FAF8F2', label: 'Light' },
  dark: { bg: '#1C1C1E', label: 'Dark' },
  black: { bg: '#000000', label: 'Black' },
}

// ============================================================
// EPUB metadata (extracted during import)
// ============================================================

export interface EpubMetadata {
  title: string
  author: string
  language: string
  publisher: string
  identifier: string
  source: string
  rights: string
}

// ============================================================
// Import result
// ============================================================

export interface ImportResult {
  success: boolean
  book?: Book
  error?: 'unsupported_source' | 'invalid_epub' | 'parse_error'
}

// ============================================================
// Archive types
// ============================================================

export interface ArchiveManifest {
  version: 1
  exportedAt: number
  books: ArchiveBookEntry[]
}

export interface ArchiveBookEntry {
  syncKey: string
  source: BookSource
  sourceId: string
  title: string
  author: string
  filename: string // path within archive: books/<filename>.epub
  hasProgress: boolean
}

// ============================================================
// Export options
// ============================================================

export interface ExportOptions {
  includeProgress: boolean
}
