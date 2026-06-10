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
// Dictionary
// ============================================================

export interface DictionaryRecord {
  id: string
  language: string
  title: string
  sourceName: string
  sourceVersion: string
  license: string
  attribution: string
  entryCount: number
  formCount: number
  installedAt: number
  sizeBytes: number
}

export interface DictionaryEntryRecord {
  key: string
  dictionaryId: string
  lemma: string
  normalizedLemma: string
  entriesJson: string
}

export interface DictionaryFormRecord {
  key: string
  dictionaryId: string
  normalizedForm: string
  lemmasJson: string
}

export interface DictionaryDefinitionGroup {
  pos: string
  definitions: string[]
  examples: string[]
  synonyms: string[]
}

export type DictionaryLookupResult =
  | {
      status: 'found'
      query: string
      normalizedQuery: string
      lemma: string
      entries: DictionaryDefinitionGroup[]
    }
  | {
      status: 'not_found'
      query: string
      normalizedQuery: string
    }
  | {
      status: 'not_installed'
      query: string
      normalizedQuery: string
    }

export interface DictionaryCatalogItem {
  id: string
  language: string
  title: string
  sourceName: string
  sourceVersion: string
  license: string
  attribution: string
  url: string
  sha256: string
  sizeBytes: number
  entryCount: number
  formCount: number
}

export interface DictionaryCatalog {
  version: 1
  generatedAt: number
  dictionaries: DictionaryCatalogItem[]
}

export interface DictionaryPackManifest {
  formatVersion: 1
  dictionaryId: string
  language: string
  title: string
  sourceName: string
  sourceVersion: string
  license: string
  attribution: string
  generatedAt: number
  entryCount: number
  formCount: number
  contentSha256: string
}

// ============================================================
// Themes
// ============================================================

export type Theme = 'light' | 'dark' | 'black'
export type ReaderLayout = 'single' | 'two'
export type AppThemeSetting = 'system' | 'light' | 'dark'
export type AppResolvedTheme = 'light' | 'dark'

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
  editionHash?: string
  title: string
  author: string
  filename: string // path within archive: books/<filename>.epub
  hasProgress: boolean
  importedAt?: number
  progressPercentage?: number
  progressUpdatedAt?: number
}

export interface ArchiveProgressEntry {
  syncKey: string
  editionHash?: string
  locator: string
  percentage: number
  updatedAt: number
}
