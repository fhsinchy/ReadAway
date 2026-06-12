import { useState, useEffect } from 'react'
import type { Book } from '@/types'
import { useBooks } from '@/hooks/useBooks'
import type { PwaInstallControls } from '@/hooks/usePwaInstall'
import { db } from '@/db'
import './LibraryScreen.css'

interface Props {
  onImportEpub: () => void
  onOpenBook: (book: Book) => void
  onSettings: () => void
  pwaInstall: PwaInstallControls
}

export function LibraryScreen({
  onImportEpub,
  onOpenBook,
  onSettings,
  pwaInstall,
}: Props) {
  const { books, loading } = useBooks()
  const { showPrompt, showInstallPrompt, dismissPrompt, triggerInstallPrompt, isInstallable } =
    pwaInstall
  const [booksWithProgress, setBooksWithProgress] = useState<
    (Book & { progress?: number; lastReadAt?: number })[]
  >([])

  useEffect(() => {
    async function load() {
      const all = await db.books.orderBy('importedAt').reverse().toArray()
      const withP = await Promise.all(
        all.map(async (book) => {
          const p = await db.progress.get(book.syncKey)
          return {
            ...book,
            progress: p?.percentage,
            lastReadAt: p?.updatedAt,
          }
        }),
      )
      // Sort: most recently read first, unread books last (by import date)
      withP.sort((a, b) => {
        const aTime = a.lastReadAt ?? 0
        const bTime = b.lastReadAt ?? 0
        if (aTime !== bTime) return bTime - aTime
        return b.importedAt - a.importedAt
      })
      setBooksWithProgress(withP)
    }
    load()
  }, [books])

  // Show install prompt after library loads
  useEffect(() => {
    if (!loading && isInstallable) {
      const timer = setTimeout(() => showInstallPrompt(), 1000)
      return () => clearTimeout(timer)
    }
  }, [loading, isInstallable, showInstallPrompt])

  if (loading) {
    return (
      <div className="library">
        <div className="library-loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="library">
      {/* App Bar */}
      <header className="library-header">
        <h1 className="library-title">ReadAway</h1>
        <div className="library-actions">
          <button className="btn-primary btn-nav btn-nav-primary" onClick={onImportEpub}>
            Add Book
          </button>
          <button className="btn-secondary btn-nav btn-nav-secondary" onClick={onSettings}>
            Settings
          </button>
        </div>
      </header>

      {/* PWA Install Prompt */}
      {showPrompt && (
        <div className="install-banner">
          <div className="install-banner-content">
            <h3>Install ReadAway</h3>
            <p>
              Read books offline and access ReadAway from your home screen.
            </p>
          </div>
          <div className="install-banner-actions">
            <button className="btn-primary" onClick={triggerInstallPrompt}>
              Install
            </button>
            <button className="btn-text" onClick={dismissPrompt}>
              Not Now
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="library-content">
        {booksWithProgress.length === 0 ? (
          <div className="library-empty">
            <p>No books yet.</p>
            <p className="library-empty-sub">
              Import EPUB books from Standard Ebooks or Project Gutenberg.
            </p>
            <button className="btn-primary" onClick={onImportEpub}>
              Import EPUB
            </button>
          </div>
        ) : (
          <section className="library-section">
            <h2 className="library-section-title">Library</h2>
            <div className="book-grid">
              {booksWithProgress.map((book) => (
                <BookCard
                  key={book.syncKey}
                  book={book}
                  onOpen={() => onOpenBook(book)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function BookCard({
  book,
  onOpen,
}: {
  book: Book & { progress?: number; lastReadAt?: number }
  onOpen: () => void
}) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen()
  }

  return (
    <article
      className="book-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      aria-label={`Read ${book.title} by ${book.author}`}
    >
      {/* Cover */}
      <div className="book-card-cover">
        {book.coverPath ? (
          <img src={book.coverPath} alt={book.title} />
        ) : (
          <div className="book-card-cover-placeholder">
            {book.title.charAt(0)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="book-card-info">
        <h3 className="book-card-title">{book.title}</h3>
        <p className="book-card-author">{book.author}</p>
        {book.progress !== undefined && book.progress > 0 && (
          <div className="book-card-progress">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${book.progress}%` }}
              />
            </div>
            <span className="progress-label">{book.progress}%</span>
          </div>
        )}
      </div>
    </article>
  )
}
