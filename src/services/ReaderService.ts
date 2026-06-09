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
}

// ============================================================
// Singleton state
// ============================================================

let state: ReaderState = {
  book: null,
  rendition: null,
  element: null,
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

  // Retrieve EPUB bytes and create a blob URL
  const epubBytes = await getEpub(storageKey)
  if (!epubBytes) {
    throw new Error(`EPUB not found in storage: ${storageKey}`)
  }

  const blob = new Blob([epubBytes], { type: 'application/epub+zip' })
  const url = URL.createObjectURL(blob)

  // Load with epub.js — blob URLs have no .epub extension,
  // so we must explicitly tell epub.js to open as an EPUB archive
  const book = ePub(url, { openAs: 'epub' })
  const rendition = book.renderTo(element, {
    width: '100%',
    height: '100%',
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

  state = { book, rendition, element }
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
    rendition.display(progress.locator)
    return true
  } catch {
    return false
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
    const location = rendition.currentLocation() as unknown as {
      start: { cfi: string; percentage: number }
    } | null
    if (!location || !location.start) return

    const start = location.start as { cfi: string; percentage: number }
    const percentage = Math.round((start.percentage || 0) * 100)

    await db.progress.put({
      syncKey,
      locator: start.cfi,
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
  rendition.on('relocated', (location: any) => {
    const start = location?.start as { cfi: string; percentage: number } | undefined
    if (start?.cfi) {
      callback(start.cfi, Math.round((start.percentage || 0) * 100))
    }
  })
}

/**
 * Clean up the current book and rendition.
 */
export function closeBook(): void {
  if (state.rendition) {
    try {
      state.rendition.destroy()
    } catch {
      // Ignore errors during cleanup
    }
  }
  state = { book: null, rendition: null, element: null }
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
