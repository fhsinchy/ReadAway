import { useState, useEffect, useCallback } from 'react'
import type { Book } from '@/types'
import { useBooks } from '@/hooks/useBooks'
import { db } from '@/db'
import './LibraryScreen.css'

interface Props {
  onImportEpub: () => void
  onOpenBook: (book: Book) => void
  onExport: () => void
  onSettings: () => void
}

export function LibraryScreen({
  onImportEpub,
  onOpenBook,
  onExport,
  onSettings,
}: Props) {
  const { books, loading } = useBooks()
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [booksWithProgress, setBooksWithProgress] = useState<
    (Book & { progress?: number })[]
  >([])

  useEffect(() => {
    async function load() {
      const all = await db.books.orderBy('importedAt').reverse().toArray()
      const withP = await Promise.all(
        all.map(async (book) => {
          const p = await db.progress.get(book.syncKey)
          return { ...book, progress: p?.percentage }
        }),
      )
      setBooksWithProgress(withP)
    }
    load()
  }, [books])

  const toggleSelection = useCallback((syncKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(syncKey)) {
        next.delete(syncKey)
      } else {
        next.add(syncKey)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(books.map((b) => b.syncKey)))
  }, [books])

  const deselectAll = useCallback(() => {
    setSelectedKeys(new Set())
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedKeys(new Set())
  }, [])

  const continuingBooks = booksWithProgress.filter((b) => b.progress !== undefined && b.progress > 0 && b.progress < 100)
  const unreadBooks = booksWithProgress.filter((b) => !b.progress || b.progress === 0 || b.progress === 100)

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
          <button className="btn-text" onClick={onImportEpub}>
            Import
          </button>
          <button className="btn-text" onClick={onExport}>
            Export
          </button>
          <button className="btn-text" onClick={onSettings}>
            Settings
          </button>
        </div>
      </header>

      {/* Selection bar */}
      {selectionMode && (
        <div className="selection-bar">
          <button className="btn-text" onClick={selectAll}>
            Select All
          </button>
          <button className="btn-text" onClick={deselectAll}>
            Deselect All
          </button>
          <span className="selection-count">
            {selectedKeys.size} selected
          </span>
          <button
            className="btn-primary"
            disabled={selectedKeys.size === 0}
            onClick={onExport}
          >
            Export Selected
          </button>
          <button className="btn-text" onClick={exitSelectionMode}>
            Cancel
          </button>
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
          <>
            {/* Continue Reading */}
            {continuingBooks.length > 0 && (
              <section className="library-section">
                <h2 className="library-section-title">Continue Reading</h2>
                <div className="book-grid">
                  {continuingBooks.map((book) => (
                    <BookCard
                      key={book.syncKey}
                      book={book}
                      onOpen={() => onOpenBook(book)}
                      selectionMode={selectionMode}
                      selected={selectedKeys.has(book.syncKey)}
                      onToggleSelect={() => toggleSelection(book.syncKey)}
                      onLongPress={() => {
                        setSelectionMode(true)
                        toggleSelection(book.syncKey)
                      }}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Library Grid */}
            <section className="library-section">
              <h2 className="library-section-title">Library</h2>
              <div className="book-grid">
                {unreadBooks.map((book) => (
                  <BookCard
                    key={book.syncKey}
                    book={book}
                    onOpen={() => onOpenBook(book)}
                    selectionMode={selectionMode}
                    selected={selectedKeys.has(book.syncKey)}
                    onToggleSelect={() => toggleSelection(book.syncKey)}
                    onLongPress={() => {
                      setSelectionMode(true)
                      toggleSelection(book.syncKey)
                    }}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function BookCard({
  book,
  onOpen,
  selectionMode,
  selected,
  onToggleSelect,
  onLongPress,
}: {
  book: Book & { progress?: number }
  onOpen: () => void
  selectionMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onLongPress: () => void
}) {
  return (
    <div
      className={`book-card ${selected ? 'book-card-selected' : ''}`}
      onClick={() => {
        if (selectionMode) {
          onToggleSelect()
        } else {
          onOpen()
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onLongPress()
      }}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className="book-card-check">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
          />
        </div>
      )}

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
    </div>
  )
}
