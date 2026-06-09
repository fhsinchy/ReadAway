import { useEffect, useRef, useState, useCallback } from 'react'
import type { Book as EpubBook, Rendition } from 'epubjs'
import type { Book, Theme } from '@/types'
import {
  openBook,
  closeBook,
  saveProgress,
  restoreProgress,
  prevPage,
  applyTheme,
  applyFontSize,
  onLocationChange,
  getBookTitle,
  ensurePageMap,
  getCurrentPagePosition,
  type PagePosition,
  type TocItem,
} from '@/services/ReaderService'
import { useTheme } from '@/hooks/useTheme'
import './ReaderScreen.css'

interface Props {
  book: Book
  onBack: () => void
}

function formatPagePosition(position: PagePosition): string {
  if (position.total) {
    if (position.end && position.end > position.current) {
      return `Page ${position.current}-${position.end} of ${position.total}`
    }
    return `Page ${position.current} of ${position.total}`
  }
  return `Page ${position.current}`
}

function formatChapterPagesLeft(position: PagePosition): string {
  if (position.chapterPagesLeft === null) return ''

  const pageText = position.chapterPagesLeft === 1 ? 'page' : 'pages'
  return `${position.chapterPagesLeft} ${pageText} left in chapter`
}

function loadNavigationWithTimeout(epubBook: EpubBook): Promise<TocItem[]> {
  return Promise.race([
    epubBook.loaded.navigation.then((navigation) => {
      return (navigation.toc as TocItem[]) || []
    }),
    new Promise<TocItem[]>((resolve) => {
      window.setTimeout(() => resolve([]), 3000)
    }),
  ])
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target as {
    isContentEditable?: boolean
    nodeName?: string
  } | null
  const nodeName = element?.nodeName?.toLowerCase()

  return (
    element?.isContentEditable === true ||
    nodeName === 'input' ||
    nodeName === 'select' ||
    nodeName === 'textarea'
  )
}

export function ReaderScreen({ book, onBack }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const effectIdRef = useRef(0)
  const appearanceOpenRef = useRef(false)
  const tocOpenRef = useRef(false)
  const { theme, setTheme, fontSize, setFontSize } = useTheme()
  const [controlsVisible, setControlsVisible] = useState(true)
  const [pagePosition, setPagePosition] = useState<PagePosition>({
    current: 1,
    total: null,
    chapterPagesLeft: null,
  })
  const [bookTitle, setBookTitle] = useState(book.title)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocLoading, setTocLoading] = useState(false)
  const [tocLoaded, setTocLoaded] = useState(false)

  useEffect(() => {
    appearanceOpenRef.current = appearanceOpen
    tocOpenRef.current = tocOpen
  }, [appearanceOpen, tocOpen])

  const handleKeyboardPageTurn = useCallback(
    (event: KeyboardEvent, preventDefault = false) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (appearanceOpenRef.current || tocOpenRef.current) return
      if (isEditableKeyboardTarget(event.target)) return

      if (preventDefault) {
        event.preventDefault()
      }

      if (event.key === 'ArrowLeft') {
        if (renditionRef.current) prevPage(renditionRef.current)
      } else if (renditionRef.current) {
        renditionRef.current.next()
      }
    },
    [],
  )

  // Initialize reader
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    const effectId = ++effectIdRef.current

    async function init() {
      if (!viewer) return
      console.log('[ReaderScreen] Init start, storageKey:', book.storageKey)
      try {
        const { book: epubBook, rendition } = await openBook(
          book.storageKey,
          viewer,
        )
        console.log('[ReaderScreen] Book opened successfully')
        if (effectId !== effectIdRef.current) {
          closeBook()
          return
        }
        renditionRef.current = rendition

        // Apply saved appearance
        applyTheme(rendition, theme)
        applyFontSize(rendition, fontSize)

        // Save progress on page change
        onLocationChange(rendition, (_locator, _pct, position) => {
          setPagePosition(position)
        })

        // Log rendering events
        rendition.on('rendered', (section: unknown) => {
          const href = (section as { href?: string } | null)?.href
          console.log('[ReaderScreen] Section rendered:', href)
        })
        rendition.on('displayed', (section: unknown) => {
          const href = (section as { href?: string } | null)?.href
          console.log('[ReaderScreen] Section displayed:', href)
        })
        rendition.on('renderError', (err: unknown) => {
          console.error('[ReaderScreen] Render error:', err)
        })
        rendition.on('displayError', (err: unknown) => {
          console.error('[ReaderScreen] Display error:', err)
        })

        // Handle clicks inside the epub.js iframe.
        rendition.on('click', () => {
          setControlsVisible((v) => !v)
        })
        rendition.on('keydown', (event: KeyboardEvent) => {
          handleKeyboardPageTurn(event)
        })

        // Restore progress or show the first readable section
        const restored = await restoreProgress(rendition, book.syncKey)
        console.log('[ReaderScreen] Progress restored:', restored)
        if (!restored) {
          console.log('[ReaderScreen] Calling rendition.display()')
          await rendition.display()
        }

        // Get title
        const title = await getBookTitle()
        if (effectId === effectIdRef.current) setBookTitle(title || book.title)

        loadNavigationWithTimeout(epubBook)
          .then((items) => {
            if (effectId === effectIdRef.current) setToc(items)
          })
          .catch((err: unknown) => {
            console.error('[ReaderScreen] Failed to load table of contents:', err)
          })
          .finally(() => {
            if (effectId === effectIdRef.current) {
              setTocLoaded(true)
              setTocLoading(false)
            }
          })

        ensurePageMap(epubBook, book)
          .then(() => {
            if (
              effectId === effectIdRef.current &&
              renditionRef.current === rendition
            ) {
              setPagePosition(getCurrentPagePosition(rendition))
            }
          })
          .catch((err: unknown) => {
            console.error('[ReaderScreen] Failed to generate locations:', err)
          })
      } catch (err) {
        console.error('Failed to open book:', err)
      }
    }

    init()

    return () => {
      renditionRef.current = null
      // This cleanup intentionally skips closing a newer reader effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (effectId === effectIdRef.current) {
        closeBook()
      }
    }
    // Appearance changes are applied by the dedicated effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.storageKey, book.syncKey, book.title, handleKeyboardPageTurn])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyboardPageTurn(event, true)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyboardPageTurn])

  // Save progress on page change
  useEffect(() => {
    const interval = setInterval(() => {
      if (renditionRef.current) {
        saveProgress(renditionRef.current, book.syncKey)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [book.syncKey])

  // Save progress on tab hide / before unload
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && renditionRef.current) {
        saveProgress(renditionRef.current, book.syncKey)
      }
    }
    const handleBeforeUnload = () => {
      if (renditionRef.current) {
        saveProgress(renditionRef.current, book.syncKey)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [book.syncKey])

  // Apply theme changes
  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, theme)
    }
  }, [theme])

  // Apply font size changes
  useEffect(() => {
    if (renditionRef.current) {
      applyFontSize(renditionRef.current, fontSize)
    }
  }, [fontSize])

  // Check for TOC chapter navigation target
  useEffect(() => {
    const target = sessionStorage.getItem('readaway-toc-target')
    if (target && renditionRef.current) {
      sessionStorage.removeItem('readaway-toc-target')
      renditionRef.current.display(target)
    }
  })

  const handleThemeChange = useCallback(
    (t: Theme) => {
      setTheme(t)
    },
    [setTheme],
  )

  const handleFontSizeDecrease = useCallback(() => {
    setFontSize(fontSize - 1)
  }, [fontSize, setFontSize])

  const handleFontSizeIncrease = useCallback(() => {
    setFontSize(fontSize + 1)
  }, [fontSize, setFontSize])

  const handlePrev = useCallback(() => {
    if (renditionRef.current) prevPage(renditionRef.current)
  }, [])

  const handleNext = useCallback(() => {
    if (renditionRef.current) renditionRef.current.next()
  }, [])

  const handleOpenToc = useCallback(() => {
    if (!tocLoaded) {
      setTocLoading(true)
    }
    setTocOpen(true)
  }, [tocLoaded])

  const handleTocItemClick = useCallback((href: string) => {
    if (!renditionRef.current) return

    renditionRef.current.display(href).catch((err: unknown) => {
      console.error('[ReaderScreen] Failed to navigate to TOC item:', err)
    })
    setTocOpen(false)
  }, [])

  return (
    <div className={`reader reader-theme-${theme}`}>
      {/* EPUB Viewer */}
      <div ref={viewerRef} className="reader-viewer" />

      {/* Controls */}
      <div
        className={`reader-controls ${controlsVisible ? '' : 'reader-controls-hidden'}`}
      >
        {/* Top bar */}
        <div className="reader-topbar">
          <button className="btn-text reader-back" onClick={onBack}>
            ← Back
          </button>
          <span className="reader-book-title">{bookTitle}</span>
          <div className="reader-topbar-actions">
            <button className="btn-text" onClick={handleOpenToc}>
              Contents
            </button>
            <button
              className="btn-text"
              onClick={() => setAppearanceOpen(!appearanceOpen)}
            >
              Aa
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="reader-bottombar">
          <button className="btn-text" onClick={handlePrev}>
            ← Prev
          </button>
          <div className="reader-page-count">
            <span className="reader-page-count-main">
              {formatPagePosition(pagePosition)}
            </span>
            {pagePosition.chapterPagesLeft !== null && (
              <span className="reader-page-count-chapter">
                {formatChapterPagesLeft(pagePosition)}
              </span>
            )}
          </div>
          <button className="btn-text" onClick={handleNext}>
            Next →
          </button>
        </div>
      </div>

      {tocOpen && (
        <div className="reader-toc-overlay" onClick={() => setTocOpen(false)}>
          <aside
            className="reader-toc-panel"
            aria-label="Contents"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="reader-toc-header">
              <div>
                <h2>Contents</h2>
                <p>{bookTitle}</p>
              </div>
              <button
                className="btn-text reader-toc-close"
                onClick={() => setTocOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="reader-toc-list">
              {tocLoading ? (
                <p className="reader-toc-message">Loading...</p>
              ) : toc.length === 0 ? (
                <p className="reader-toc-message">
                  No table of contents available.
                </p>
              ) : (
                toc.map((item, i) => (
                  <ReaderTocItem
                    key={item.id || `${item.href}-${i}`}
                    item={item}
                    onClick={handleTocItemClick}
                  />
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Appearance sheet */}
      {appearanceOpen && (
        <div
          className="appearance-overlay"
          onClick={() => setAppearanceOpen(false)}
        >
          <div
            className="appearance-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="appearance-title">Appearance</h3>

            {/* Theme */}
            <div className="appearance-section">
              <h4>Theme</h4>
              <div className="theme-options">
                {(
                  [
                    { key: 'light', label: 'Light' },
                    { key: 'dark', label: 'Dark' },
                    { key: 'black', label: 'Black' },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`theme-btn ${theme === key ? 'theme-btn-active' : ''}`}
                    onClick={() => handleThemeChange(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="appearance-section">
              <h4>Font Size</h4>
              <div className="font-size-control">
                <button className="btn-text" onClick={handleFontSizeDecrease}>
                  −
                </button>
                <span className="font-size-value">{fontSize}</span>
                <button className="btn-text" onClick={handleFontSizeIncrease}>
                  +
                </button>
              </div>
            </div>

            <button
              className="btn-primary appearance-close"
              onClick={() => setAppearanceOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReaderTocItem({
  item,
  onClick,
  depth = 0,
}: {
  item: TocItem
  onClick: (href: string) => void
  depth?: number
}) {
  return (
    <>
      <button
        className="reader-toc-item"
        style={{ paddingLeft: 20 + depth * 18 }}
        onClick={() => onClick(item.href)}
      >
        {item.label}
      </button>
      {item.subitems?.map((subitem, i) => (
        <ReaderTocItem
          key={subitem.id || `${subitem.href}-${i}`}
          item={subitem}
          onClick={onClick}
          depth={depth + 1}
        />
      ))}
    </>
  )
}
