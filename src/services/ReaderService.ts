/**
 * ReaderService
 *
 * Wraps epub.js to provide reading functionality.
 * epub.js must not leak into the rest of the application.
 * All reader interactions must go through this service.
 */

import ePub, { type Book, type Rendition } from 'epubjs'
import type { Book as LibraryBook, Theme } from '@/types'
import { db } from '@/db'
import { getEpub } from './BookStorageService'

// ============================================================
// Types
// ============================================================

export interface TocItem {
  id: string
  label: string
  href: string
  subitems?: TocItem[]
}

export interface ReaderState {
  book: Book | null
  rendition: Rendition | null
  element: HTMLElement | null
  onResize: (() => void) | null
  resizeObserver: ResizeObserver | null
}

export interface PagePosition {
  current: number
  end?: number
  total: number | null
  chapterPagesLeft: number | null
}

interface ReaderLocation {
  start?: {
    cfi?: string
    percentage?: number
    index?: string | number
    displayed?: {
      page?: number
      total?: number
    }
  }
  end?: {
    cfi?: string
    displayed?: {
      page?: number
      total?: number
    }
  }
}

export const PAGE_MAP_ALGORITHM_VERSION = 1
export const SYNTHETIC_PAGE_CHARS = 2000

const STANDARD_EBOOKS_HIDDEN_LABEL_SELECTOR = [
  'section.epub-type-contains-word-titlepage h1',
  'section.epub-type-contains-word-titlepage p',
  'section.epub-type-contains-word-colophon h2',
  'section.epub-type-contains-word-imprint h2',
].join(', ')

const STANDARD_EBOOKS_BLACK_TRANSPARENT_IMAGE_SELECTOR =
  'img.epub-type-contains-word-se-image-color-depth-black-on-transparent'

const READER_EPUB_NORMALIZATION_RULES: object = [
  [
    STANDARD_EBOOKS_HIDDEN_LABEL_SELECTOR,
    ['position', 'absolute', true],
    ['left', '0', true],
    ['top', '0', true],
    ['width', '1px', true],
    ['height', '1px', true],
    ['overflow', 'hidden', true],
    ['clip', 'rect(0 0 0 0)', true],
    ['clip-path', 'inset(50%)', true],
    ['white-space', 'nowrap', true],
    ['margin', '0', true],
    ['padding', '0', true],
    ['border', '0', true],
  ],
  [
    'section.epub-type-contains-word-titlepage img',
    ['display', 'block', true],
    ['width', 'min(72%, 560px)', true],
    ['height', 'auto', true],
    ['max-width', '100%', true],
    ['max-height', 'calc(100vh - 6em)', true],
    ['object-fit', 'contain', true],
  ],
]

function pageMapKey(book: LibraryBook): string {
  return [
    book.syncKey,
    book.editionHash,
    `stable-pages-v${PAGE_MAP_ALGORITHM_VERSION}`,
    `chars-${SYNTHETIC_PAGE_CHARS}`,
  ].join('|')
}

function disableForcedBlankPages(rendition: Rendition): void {
  const manager = (
    rendition as unknown as {
      manager?: {
        viewSettings?: {
          forceEvenPages?: boolean
        }
      }
    }
  ).manager

  if (manager?.viewSettings) {
    manager.viewSettings.forceEvenPages = false
  }
}

function pageFromCfi(rendition: Rendition, cfi: string, total: number): number {
  const location = Number(rendition.book.locations.locationFromCfi(cfi))
  const page = Number.isFinite(location) ? location + 1 : 1
  return Math.max(1, Math.min(total, page))
}

function getChapterPagesLeft(location: ReaderLocation | null): number | null {
  const total = location?.start?.displayed?.total
  if (!total || total < 1) return null

  const endPage =
    location.end?.displayed?.page ?? location.start?.displayed?.page ?? 1

  return Math.max(0, total - endPage)
}

// ============================================================
// Singleton state
// ============================================================

let state: ReaderState = {
  book: null,
  rendition: null,
  element: null,
  onResize: null,
  resizeObserver: null,
}

// ============================================================
// Open book
// ============================================================

/**
 * Open a book from storage and render it into the given element.
 * Returns the book and rendition instances.
 */
export async function openBook(
  storageKey: string,
  element: HTMLElement,
): Promise<{ book: Book; rendition: Rendition }> {
  // Retrieve EPUB bytes from browser-managed storage
  const epubBytes = await getEpub(storageKey)

  if (!epubBytes) {
    throw new Error(`EPUB not found in storage: ${storageKey}`)
  }

  // Measure the container for actual pixel dimensions.
  // epub.js parseFloat('100%') = 100, not the container size.
  const rect = element.getBoundingClientRect()
  const width = rect.width || window.innerWidth
  const height = rect.height || window.innerHeight

  // Load the stored EPUB bytes directly so epub.js opens it as an archive.
  const book = ePub(epubBytes)

  // Log any loading errors
  book.opened.catch((err: Error) => {
    console.error('epub.js failed to open book:', err)
  })

  console.log('[ReaderService] Opening book:', storageKey, 'size:', width, 'x', height)
  const renditionOptions = {
    width,
    height,
    spread: 'none',
    minSpreadWidth: Number.POSITIVE_INFINITY,
    flow: 'paginated',
    allowScriptedContent: true,
  }
  const rendition = book.renderTo(element, renditionOptions)
  disableForcedBlankPages(rendition)
  rendition.spread('none', Number.POSITIVE_INFINITY)

  // Normalize supported EPUB quirks before applying user themes.
  rendition.themes.default(READER_EPUB_NORMALIZATION_RULES)

  // Apply default theme
  rendition.themes.register('light', {
    'body.light': {
      background: '#FAF8F2',
      color: '#1C1C1E',
    },
    [`body.light ${STANDARD_EBOOKS_BLACK_TRANSPARENT_IMAGE_SELECTOR}`]: {
      filter: 'none',
    },
  })
  rendition.themes.register('dark', {
    'body.dark': {
      background: '#1C1C1E',
      color: '#E5E5E5',
    },
    [`body.dark ${STANDARD_EBOOKS_BLACK_TRANSPARENT_IMAGE_SELECTOR}`]: {
      filter: 'invert(100%)',
    },
  })
  rendition.themes.register('black', {
    'body.black': {
      background: '#000000',
      color: '#CCCCCC',
    },
    [`body.black ${STANDARD_EBOOKS_BLACK_TRANSPARENT_IMAGE_SELECTOR}`]: {
      filter: 'invert(100%)',
    },
  })
  rendition.themes.select('light')

  // Handle window resize
  const onResize = () => {
    if (state.rendition !== rendition) return
    const r = element.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      // epub.js may not have fully initialized yet (render queue still
      // processing). Silently skip — the ResizeObserver will fire again.
      try {
        rendition.resize(r.width, r.height)
      } catch (err) {
        console.debug('[ReaderService] Resize skipped, epub.js not ready:', err)
      }
    }
  }
  window.addEventListener('resize', onResize)

  const resizeObserver =
    'ResizeObserver' in window ? new ResizeObserver(onResize) : null
  resizeObserver?.observe(element)

  state = { book, rendition, element, onResize, resizeObserver }

  return { book, rendition }
}

// ============================================================
// Progress
// ============================================================

/**
 * Restore reading progress from the database.
 * Returns true if progress was restored.
 */
export async function restoreProgress(
  rendition: Rendition,
  syncKey: string,
): Promise<boolean> {
  const progress = await db.progress.get(syncKey)
  if (!progress) return false

  try {
    // epub.js uses EPUB CFI locators
    await rendition.display(progress.locator)
    return true
  } catch (err) {
    console.debug('[ReaderService] No saved progress to restore:', err)
    return false
  }
}

/**
 * Load or generate the stable synthetic page map for a book.
 */
export async function ensurePageMap(
  epubBook: Book,
  libraryBook: LibraryBook,
): Promise<void> {
  if (epubBook.locations.length() > 0) return

  await epubBook.ready

  const key = pageMapKey(libraryBook)
  const cached = await db.pageMaps.get(key)
  if (
    cached &&
    cached.algorithmVersion === PAGE_MAP_ALGORITHM_VERSION &&
    cached.charsPerPage === SYNTHETIC_PAGE_CHARS
  ) {
    epubBook.locations.load(cached.locations)
    return
  }

  await epubBook.locations.generate(SYNTHETIC_PAGE_CHARS)

  const now = Date.now()
  await db.pageMaps.put({
    key,
    syncKey: libraryBook.syncKey,
    editionHash: libraryBook.editionHash,
    algorithmVersion: PAGE_MAP_ALGORITHM_VERSION,
    charsPerPage: SYNTHETIC_PAGE_CHARS,
    locations: epubBook.locations.save(),
    createdAt: cached?.createdAt ?? now,
    updatedAt: now,
  })
}

/**
 * Get a whole-book page-like position from generated CFI locations.
 */
export function getCurrentPagePosition(rendition: Rendition): PagePosition {
  try {
    const location = rendition.currentLocation() as unknown as ReaderLocation | null
    const cfi = location?.start?.cfi
    const endCfi = location?.end?.cfi
    const total = rendition.book.locations.length()

    if (cfi && total > 0) {
      const current = pageFromCfi(rendition, cfi, total)
      const end = endCfi ? pageFromCfi(rendition, endCfi, total) : current
      return {
        current,
        end: Math.max(current, end),
        total,
        chapterPagesLeft: getChapterPagesLeft(location),
      }
    }

    return {
      current: Math.max(1, location?.start?.displayed?.page ?? 1),
      total: null,
      chapterPagesLeft: getChapterPagesLeft(location),
    }
  } catch (err) {
    console.debug('[ReaderService] Failed to get page position:', err)
    return { current: 1, total: null, chapterPagesLeft: null }
  }
}

function getSpineItemCount(book: Book): number {
  return (
    (book.spine as unknown as { spineItems?: unknown[] }).spineItems?.length ?? 0
  )
}

function getFallbackPercentage(
  location: ReaderLocation,
  rendition: Rendition,
): number {
  const start = location.start
  if (!start) return 0

  if (typeof start.percentage === 'number') {
    return Math.round(start.percentage * 100)
  }

  const spineIndex = Number(start.index)
  const spineCount = getSpineItemCount(rendition.book)
  if (!Number.isFinite(spineIndex) || spineCount <= 0) return 0

  const displayedPage = start.displayed?.page ?? 1
  const displayedTotal = start.displayed?.total ?? 1
  const sectionProgress = Math.max(
    0,
    Math.min(1, (displayedPage - 1) / displayedTotal),
  )

  return Math.round(((spineIndex + sectionProgress) / spineCount) * 100)
}

/**
 * Get whole-book progress from the current visible CFI.
 */
export function getCurrentPercentage(rendition: Rendition): number {
  try {
    const location = rendition.currentLocation() as unknown as ReaderLocation | null
    const cfi = location?.start?.cfi

    if (cfi && rendition.book.locations.length() > 0) {
      return Math.round(rendition.book.locations.percentageFromCfi(cfi) * 100)
    }

    return location ? getFallbackPercentage(location, rendition) : 0
  } catch (err) {
    console.debug('[ReaderService] Failed to get percentage:', err)
    return 0
  }
}

/**
 * Save current reading progress to the database.
 */
export async function saveProgress(
  rendition: Rendition,
  syncKey: string,
): Promise<void> {
  try {
    const location = rendition.currentLocation() as unknown as ReaderLocation | null
    const cfi = location?.start?.cfi
    if (!cfi) return

    const percentage = getCurrentPercentage(rendition)

    await db.progress.put({
      syncKey,
      locator: cfi,
      percentage,
      updatedAt: Date.now(),
    })
  } catch (err) {
    console.debug('[ReaderService] Failed to save progress:', err)
  }
}

// ============================================================
// Navigation
// ============================================================

/**
 * Get the table of contents for the current book.
 */
export async function getTableOfContents(): Promise<TocItem[]> {
  if (!state.book) return []

  try {
    const navigation = await state.book.loaded.navigation
    return (navigation.toc as TocItem[]) || []
  } catch (err) {
    console.debug('[ReaderService] Failed to load table of contents:', err)
    return []
  }
}

/**
 * Navigate to a specific href (chapter/section).
 */
export function navigateTo(rendition: Rendition, href: string): void {
  rendition.display(href)
}

/**
 * Go to the next page.
 */
export function nextPage(rendition: Rendition): void {
  rendition.next()
}

/**
 * Go to the previous page.
 */
export function prevPage(rendition: Rendition): void {
  rendition.prev()
}

// ============================================================
// Appearance
// ============================================================

/**
 * Apply a theme to the rendition.
 */
export function applyTheme(rendition: Rendition, theme: Theme): void {
  rendition.themes.select(theme)
}

/**
 * Apply font size to the rendition.
 */
export function applyFontSize(rendition: Rendition, size: number): void {
  rendition.themes.fontSize(`${size}px`)
}

// ============================================================
// Lifecycle
// ============================================================

/**
 * Register a callback for page changes (e.g., to save progress).
 */
export function onLocationChange(
  rendition: Rendition,
  callback: (
    locator: string,
    percentage: number,
    pagePosition: PagePosition,
  ) => void,
): void {
  rendition.on('relocated', (location: unknown) => {
    const start = (location as {
      start?: { cfi?: string; percentage?: number }
    } | null)?.start
    if (start?.cfi) {
      callback(
        start.cfi,
        getCurrentPercentage(rendition),
        getCurrentPagePosition(rendition),
      )
    }
  })
}

/**
 * Clean up the current book and rendition.
 */
export function closeBook(): void {
  if (state.resizeObserver) {
    state.resizeObserver.disconnect()
  }

  if (state.onResize) {
    window.removeEventListener('resize', state.onResize)
  }

  if (state.rendition) {
    try {
      state.rendition.destroy()
    } catch (err) {
      console.debug('[ReaderService] Error destroying rendition:', err)
    }
  }

  if (state.book) {
    try {
      state.book.destroy()
    } catch (err) {
      console.debug('[ReaderService] Error destroying book:', err)
    }
  }

  state = {
    book: null,
    rendition: null,
    element: null,
    onResize: null,
    resizeObserver: null,
  }
}

/**
 * Get the current book title from epub.js metadata.
 */
export async function getBookTitle(): Promise<string> {
  if (!state.book) return ''
  try {
    const meta = await state.book.loaded.metadata
    return meta.title || ''
  } catch (err) {
    console.debug('[ReaderService] Failed to get book title:', err)
    return ''
  }
}
