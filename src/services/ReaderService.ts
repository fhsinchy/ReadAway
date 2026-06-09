/**
 * ReaderService
 *
 * Wraps epub.js to provide reading functionality.
 * epub.js must not leak into the rest of the application.
 * All reader interactions must go through this service.
 */

import ePub, { type Book, type Rendition } from 'epubjs'
import type { Theme } from '@/types'
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
  // Clean up any existing book
  closeBook()

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
  const rendition = book.renderTo(element, {
    width,
    height,
    spread: 'none',
    flow: 'paginated',
  })

  // Apply default theme
  rendition.themes.register('light', {
    body: {
      background: '#FAF8F2',
      color: '#1C1C1E',
    },
  })
  rendition.themes.register('dark', {
    body: {
      background: '#1C1C1E',
      color: '#E5E5E5',
    },
  })
  rendition.themes.register('black', {
    body: {
      background: '#000000',
      color: '#CCCCCC',
    },
  })
  rendition.themes.select('light')

  // Handle window resize
  const onResize = () => {
    const r = element.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      rendition.resize(r.width, r.height)
    }
  }
  window.addEventListener('resize', onResize)

  const resizeObserver =
    'ResizeObserver' in window ? new ResizeObserver(onResize) : null
  resizeObserver?.observe(element)
  requestAnimationFrame(onResize)

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
  } catch {
    return false
  }
}

/**
 * Generate CFI locations so whole-book percentage can be calculated.
 */
export async function generateLocations(book: Book): Promise<void> {
  if (book.locations.length() > 0) return

  await book.ready
  await book.locations.generate(1600)
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
  } catch {
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
  } catch {
    // Silently fail — progress is best-effort
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
  } catch {
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
  callback: (locator: string, percentage: number) => void,
): void {
  rendition.on('relocated', (location: unknown) => {
    const start = (location as {
      start?: { cfi?: string; percentage?: number }
    } | null)?.start
    if (start?.cfi) {
      callback(start.cfi, getCurrentPercentage(rendition))
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

  if (state.book) {
    try {
      state.book.destroy()
    } catch {
      // Ignore errors during cleanup
    }
  } else if (state.rendition) {
    try {
      state.rendition.destroy()
    } catch {
      // Ignore errors during cleanup
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
  } catch {
    return ''
  }
}
