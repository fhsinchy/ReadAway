import { useEffect, useRef, useState, useCallback } from 'react'
import type { Rendition } from 'epubjs'
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
} from '@/services/ReaderService'
import { useTheme } from '@/hooks/useTheme'
import './ReaderScreen.css'

interface Props {
  book: Book
  onBack: () => void
  onToc: () => void
}

export function ReaderScreen({ book, onBack, onToc }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const effectIdRef = useRef(0)
  const { theme, setTheme, fontSize, setFontSize } = useTheme()
  const [controlsVisible, setControlsVisible] = useState(true)
  const [percentage, setPercentage] = useState(0)
  const [bookTitle, setBookTitle] = useState(book.title)
  const [appearanceOpen, setAppearanceOpen] = useState(false)

  // Initialize reader
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    const effectId = ++effectIdRef.current

    async function init() {
      if (!viewer) return
      console.log('[ReaderScreen] Init start, storageKey:', book.storageKey)
      try {
        const { rendition } = await openBook(book.storageKey, viewer)
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
        onLocationChange(rendition, (_locator, pct) => {
          setPercentage(pct)
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

        // Handle clicks inside the epub.js iframe for tap zones
        rendition.on('click', (e: MouseEvent) => {
          if (!viewer) return
          const rect = viewer.getBoundingClientRect()
          const x = e.clientX - rect.left
          const width = rect.width

          if (x < width * 0.3) {
            // Left zone: previous page
            prevPage(rendition)
          } else if (x > width * 0.7) {
            // Right zone: next page
            rendition.next()
          } else {
            // Center: toggle controls
            setControlsVisible((v) => !v)
          }
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
  }, [book.storageKey, book.syncKey, book.title])

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
            <button className="btn-text" onClick={onToc}>
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
          <div className="reader-progress">{percentage}%</div>
          <button className="btn-text" onClick={handleNext}>
            Next →
          </button>
        </div>
      </div>

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
