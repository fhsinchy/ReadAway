import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import type { Book as EpubBook, Rendition } from 'epubjs'
import type { Book, ReaderLayout, Theme } from '@/types'
import {
  openBook,
  closeBook,
  saveProgress,
  restoreProgress,
  applyTheme,
  applyFontSize,
  applyReaderLayout,
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

const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 28
const FONT_SIZE_STEP = 1
const PAGE_TURN_ANIMATION_MS = 260
const SWIPE_MIN_DISTANCE = 50
const SWIPE_AXIS_RATIO = 1.5
const TWO_COLUMN_MIN_WIDTH = 840
const TWO_COLUMN_MIN_HEIGHT = 480
const PAGE_COLOR_OPTIONS = [
  { key: 'light', label: 'Light', swatch: '#FAF8F2' },
  { key: 'dark', label: 'Dark', swatch: '#1C1C1E' },
  { key: 'black', label: 'Black', swatch: '#000000' },
] as const
const LAYOUT_OPTIONS = [
  { key: 'single', label: 'Single Column', icon: ['wide', 'wide', 'wide'] },
  { key: 'two', label: 'Two Columns', icon: ['split', 'split', 'split'] },
] as const

function isTwoColumnEligible(width: number, height: number): boolean {
  return width >= TWO_COLUMN_MIN_WIDTH && height >= TWO_COLUMN_MIN_HEIGHT
}

function getInitialTwoColumnEligibility(): boolean {
  if (typeof window === 'undefined') return false
  return isTwoColumnEligible(window.innerWidth, window.innerHeight)
}

function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

type FullscreenCapableDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
}

function getFullscreenElement(): Element | null {
  const fullscreenDocument = document as FullscreenCapableDocument
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null
}

function isFullscreenSupported(element: HTMLElement | null): boolean {
  if (!element) return false
  const fullscreenElement = element as FullscreenCapableElement
  const fullscreenDocument = document as FullscreenCapableDocument

  return (
    document.fullscreenEnabled === true ||
    fullscreenDocument.webkitFullscreenEnabled === true ||
    typeof fullscreenElement.webkitRequestFullscreen === 'function'
  )
}

async function requestReaderFullscreen(element: HTMLElement): Promise<void> {
  const fullscreenElement = element as FullscreenCapableElement
  if (element.requestFullscreen) {
    await element.requestFullscreen()
    return
  }
  await fullscreenElement.webkitRequestFullscreen?.()
}

async function exitReaderFullscreen(): Promise<void> {
  const fullscreenDocument = document as FullscreenCapableDocument
  if (document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }
  await fullscreenDocument.webkitExitFullscreen?.()
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

function getFontSizeSliderStyle(fontSize: number): CSSProperties {
  const progress =
    ((fontSize - MIN_FONT_SIZE) / (MAX_FONT_SIZE - MIN_FONT_SIZE)) * 100

  return {
    '--font-size-progress': `${progress}%`,
  } as CSSProperties
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

function getTouchPoint(event: TouchEvent): { x: number; y: number } | null {
  const touch = event.changedTouches[0] ?? event.touches[0]
  if (!touch) return null
  return { x: touch.clientX, y: touch.clientY }
}

export function ReaderScreen({ book, onBack }: Props) {
  const readerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const effectIdRef = useRef(0)
  const appearanceOpenRef = useRef(false)
  const tocOpenRef = useRef(false)
  const pageTurnInFlightRef = useRef(false)
  const pageTurnTimeoutRef = useRef<number | null>(null)
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    readerLayout,
    setReaderLayout,
    pageTurnAnimation,
    setPageTurnAnimation,
  } = useTheme()
  const [twoColumnEligible, setTwoColumnEligible] = useState(
    getInitialTwoColumnEligibility,
  )
  const [renditionReadyId, setRenditionReadyId] = useState(0)
  const [pageTurnDirection, setPageTurnDirection] = useState<
    'next' | 'prev' | null
  >(null)
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
  const [fullscreenSupported, setFullscreenSupported] = useState(false)
  const [fullscreenActive, setFullscreenActive] = useState(false)

  useEffect(() => {
    appearanceOpenRef.current = appearanceOpen
    tocOpenRef.current = tocOpen
  }, [appearanceOpen, tocOpen])

  useLayoutEffect(() => {
    const reader = readerRef.current
    if (!reader) return

    const updateEligibility = () => {
      const rect = reader.getBoundingClientRect()
      setTwoColumnEligible(isTwoColumnEligible(rect.width, rect.height))
    }

    updateEligibility()

    const resizeObserver =
      'ResizeObserver' in window ? new ResizeObserver(updateEligibility) : null
    resizeObserver?.observe(reader)
    window.addEventListener('resize', updateEligibility)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateEligibility)
    }
  }, [])

  useEffect(() => {
    const reader = readerRef.current
    if (!reader) return

    const updateFullscreenState = () => {
      setFullscreenSupported(isFullscreenSupported(reader))
      setFullscreenActive(getFullscreenElement() === reader)
    }

    updateFullscreenState()
    document.addEventListener('fullscreenchange', updateFullscreenState)
    document.addEventListener('webkitfullscreenchange', updateFullscreenState)

    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState)
      document.removeEventListener(
        'webkitfullscreenchange',
        updateFullscreenState,
      )
    }
  }, [])

  const effectiveLayout: ReaderLayout =
    readerLayout === 'two' && twoColumnEligible ? 'two' : 'single'

  const navigatePage = useCallback(
    (direction: 'next' | 'prev') => {
      const rendition = renditionRef.current
      if (!rendition || pageTurnInFlightRef.current) return

      const turnPage = () =>
        direction === 'prev' ? rendition.prev() : rendition.next()

      if (!pageTurnAnimation || shouldReduceMotion()) {
        turnPage()
        return
      }

      pageTurnInFlightRef.current = true
      setPageTurnDirection(null)

      window.requestAnimationFrame(() => {
        setPageTurnDirection(direction)
      })

      turnPage().finally(() => {
        if (pageTurnTimeoutRef.current !== null) {
          window.clearTimeout(pageTurnTimeoutRef.current)
        }
        pageTurnTimeoutRef.current = window.setTimeout(() => {
          setPageTurnDirection(null)
          pageTurnInFlightRef.current = false
          pageTurnTimeoutRef.current = null
        }, PAGE_TURN_ANIMATION_MS)
      })
    },
    [pageTurnAnimation],
  )

  const handleKeyboardPageTurn = useCallback(
    (event: KeyboardEvent, preventDefault = false) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (appearanceOpenRef.current || tocOpenRef.current) return
      if (isEditableKeyboardTarget(event.target)) return

      if (preventDefault) {
        event.preventDefault()
      }

      navigatePage(event.key === 'ArrowLeft' ? 'prev' : 'next')
    },
    [navigatePage],
  )

  const handleSwipeStart = useCallback((event: TouchEvent) => {
    if (appearanceOpenRef.current || tocOpenRef.current) return
    swipeStartRef.current = getTouchPoint(event)
  }, [])

  const handleSwipeEnd = useCallback(
    (event: TouchEvent) => {
      if (appearanceOpenRef.current || tocOpenRef.current) return

      const start = swipeStartRef.current
      swipeStartRef.current = null
      if (!start) return

      const end = getTouchPoint(event)
      if (!end) return

      const deltaX = end.x - start.x
      const deltaY = end.y - start.y
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      if (absX < SWIPE_MIN_DISTANCE || absX < absY * SWIPE_AXIS_RATIO) {
        return
      }

      event.preventDefault()
      navigatePage(deltaX < 0 ? 'next' : 'prev')
    },
    [navigatePage],
  )

  useEffect(() => {
    return () => {
      if (pageTurnTimeoutRef.current !== null) {
        window.clearTimeout(pageTurnTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    viewer.addEventListener('touchstart', handleSwipeStart, { passive: true })
    viewer.addEventListener('touchend', handleSwipeEnd, { passive: false })

    return () => {
      viewer.removeEventListener('touchstart', handleSwipeStart)
      viewer.removeEventListener('touchend', handleSwipeEnd)
    }
  }, [handleSwipeEnd, handleSwipeStart])

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
          effectiveLayout,
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
        rendition.on('touchstart', (event: TouchEvent) => {
          handleSwipeStart(event)
        })
        rendition.on('touchend', (event: TouchEvent) => {
          handleSwipeEnd(event)
        })

        // Restore progress or show the first readable section
        const restored = await restoreProgress(rendition, book.syncKey)
        console.log('[ReaderScreen] Progress restored:', restored)
        if (!restored) {
          console.log('[ReaderScreen] Calling rendition.display()')
          await rendition.display()
        }
        if (effectId === effectIdRef.current) {
          setRenditionReadyId((id) => id + 1)
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

  // Apply reader layout changes
  useEffect(() => {
    const rendition = renditionRef.current
    const viewer = viewerRef.current
    if (!rendition || !viewer) return

    const frame = window.requestAnimationFrame(() => {
      const rect = viewer.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      applyReaderLayout(rendition, effectiveLayout, rect.width, rect.height)
      window.setTimeout(() => {
        if (renditionRef.current === rendition) {
          setPagePosition(getCurrentPagePosition(rendition))
        }
      }, 0)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [effectiveLayout, renditionReadyId])

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

  const handleFontSizeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFontSize(Number(event.target.value))
    },
    [setFontSize],
  )

  const handleLayoutChange = useCallback(
    (layout: ReaderLayout) => {
      if (layout === 'two' && !twoColumnEligible) return
      setReaderLayout(layout)
    },
    [setReaderLayout, twoColumnEligible],
  )

  const handlePrev = useCallback(() => {
    navigatePage('prev')
  }, [navigatePage])

  const handleNext = useCallback(() => {
    navigatePage('next')
  }, [navigatePage])

  const handleOpenToc = useCallback(() => {
    if (!tocLoaded) {
      setTocLoading(true)
    }
    setAppearanceOpen(false)
    setTocOpen(true)
  }, [tocLoaded])

  const handleOpenAppearance = useCallback(() => {
    setTocOpen(false)
    setAppearanceOpen(true)
  }, [])

  const handleToggleFullscreen = useCallback(() => {
    const reader = readerRef.current
    if (!reader) return

    const action =
      getFullscreenElement() === reader
        ? exitReaderFullscreen()
        : requestReaderFullscreen(reader)

    action.catch((err: unknown) => {
      console.debug('[ReaderScreen] Fullscreen request failed:', err)
    })
  }, [])

  const handleTocItemClick = useCallback((href: string) => {
    if (!renditionRef.current) return

    renditionRef.current.display(href).catch((err: unknown) => {
      console.error('[ReaderScreen] Failed to navigate to TOC item:', err)
    })
    setTocOpen(false)
  }, [])

  return (
    <div
      ref={readerRef}
      className={`reader reader-theme-${theme} reader-layout-${effectiveLayout} ${pageTurnDirection ? `reader-page-turn-${pageTurnDirection}` : ''}`}
    >
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
            {fullscreenSupported && (
              <button
                className="btn-text reader-fullscreen"
                onClick={handleToggleFullscreen}
              >
                {fullscreenActive ? 'Exit Full Screen' : 'Full Screen'}
              </button>
            )}
            <button className="btn-text" onClick={handleOpenToc}>
              Contents
            </button>
            <button
              className="btn-text"
              onClick={handleOpenAppearance}
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

      <div
        className={`reader-drawer-overlay reader-toc-overlay ${tocOpen ? 'reader-drawer-open' : ''}`}
        aria-hidden={!tocOpen}
        inert={!tocOpen}
        onClick={() => setTocOpen(false)}
      >
        <aside
          className="reader-drawer-panel reader-toc-panel"
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

      {/* Appearance panel */}
      <div
        className={`reader-drawer-overlay appearance-overlay ${appearanceOpen ? 'reader-drawer-open' : ''}`}
        aria-hidden={!appearanceOpen}
        inert={!appearanceOpen}
        onClick={() => setAppearanceOpen(false)}
      >
        <aside
          className="reader-drawer-panel appearance-panel"
          aria-label="Appearance"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="reader-toc-header">
            <div>
              <h2>Appearance</h2>
              <p>{bookTitle}</p>
            </div>
            <button
              className="btn-text reader-toc-close"
              onClick={() => setAppearanceOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="appearance-panel-content">
            {/* Page Color */}
            <div className="appearance-section">
              <h4>Page Color</h4>
              <div className="theme-options">
                {PAGE_COLOR_OPTIONS.map(({ key, label, swatch }) => (
                  <button
                    key={key}
                    className={`theme-btn ${theme === key ? 'theme-btn-active' : ''}`}
                    onClick={() => handleThemeChange(key)}
                  >
                    <span
                      className="theme-btn-swatch"
                      style={{ backgroundColor: swatch }}
                    />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="appearance-section">
              <h4>Font Size</h4>
              <div className="font-size-slider-control">
                <span className="font-size-slider-label font-size-slider-label-small">
                  A
                </span>
                <input
                  className="font-size-slider"
                  type="range"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  step={FONT_SIZE_STEP}
                  value={fontSize}
                  style={getFontSizeSliderStyle(fontSize)}
                  aria-label="Font size"
                  onChange={handleFontSizeChange}
                />
                <span className="font-size-slider-label font-size-slider-label-large">
                  A
                </span>
              </div>
            </div>

            {/* Layout */}
            <div className="appearance-section">
              <h4>Layout</h4>
              <div className="layout-options">
                {LAYOUT_OPTIONS.map((option) => {
                  const disabled = option.key === 'two' && !twoColumnEligible
                  return (
                    <button
                      key={option.key}
                      className={`layout-btn ${effectiveLayout === option.key ? 'layout-btn-active' : ''}`}
                      disabled={disabled}
                      onClick={() => handleLayoutChange(option.key)}
                    >
                      <span className="layout-btn-icon" aria-hidden="true">
                        {option.icon.map((line, i) => (
                          <span
                            key={`${option.key}-${line}-${i}`}
                            className={`layout-btn-line layout-btn-line-${line}`}
                          />
                        ))}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
              {!twoColumnEligible && (
                <p className="appearance-helper">
                  Two columns are available on larger screens.
                </p>
              )}
            </div>

            {/* Page Turn */}
            <div className="appearance-section">
              <h4>Page Turn</h4>
              <div className="page-turn-setting">
                <span>Slide Animation</span>
                <button
                  className={`page-turn-toggle ${pageTurnAnimation ? 'page-turn-toggle-active' : ''}`}
                  type="button"
                  aria-label="Slide page turn animation"
                  aria-pressed={pageTurnAnimation}
                  onClick={() => setPageTurnAnimation(!pageTurnAnimation)}
                >
                  <span />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
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
