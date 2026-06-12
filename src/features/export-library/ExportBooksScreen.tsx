import { useState, useEffect, useCallback } from 'react'
import type { Book } from '@/types'
import { db } from '@/db'
import { exportArchive } from '@/services/ExportService'
import '@/components/ArchiveFlowScreen.css'

interface Props {
  onBack: () => void
}

type ExportPhase = 'select' | 'exporting' | 'done'

export function ExportBooksScreen({ onBack }: Props) {
  const [books, setBooks] = useState<Book[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<ExportPhase>('select')

  useEffect(() => {
    db.books.orderBy('importedAt').reverse().toArray().then(setBooks)
  }, [])

  const toggleBook = useCallback((syncKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(syncKey)) next.delete(syncKey)
      else next.add(syncKey)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(books.map((b) => b.syncKey)))
  }, [books])

  const deselectAll = useCallback(() => {
    setSelectedKeys(new Set())
  }, [])

  const handleExport = useCallback(async () => {
    if (selectedKeys.size === 0) return

    setPhase('exporting')

    try {
      const blob = await exportArchive([...selectedKeys])

      // Trigger browser download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `readaway-backup-${Date.now()}.raway`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setPhase('done')
    } catch (err) {
      console.error('Export failed:', err)
      setPhase('select')
    }
  }, [selectedKeys])

  return (
    <div className="archive-flow-screen">
      <header className="archive-flow-header">
        <button className="btn-text" onClick={onBack}>
          ← Back
        </button>
        <h2 className="archive-flow-title">Back Up Library</h2>
        <div className="archive-flow-header-spacer" />
      </header>

      {phase === 'select' && (
        <>
          <div className="archive-flow-content">
            <div className="archive-flow-toolbar">
              <button className="btn-text" onClick={selectAll}>
                Select All
              </button>
              <button className="btn-text" onClick={deselectAll}>
                Deselect All
              </button>
            </div>

            <div className="archive-flow-book-list">
              {books.map((book) => (
                <div key={book.syncKey} className="archive-flow-book-item">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(book.syncKey)}
                    onChange={() => toggleBook(book.syncKey)}
                  />
                  <div className="archive-flow-book-info">
                    <div className="archive-flow-book-title">{book.title}</div>
                    <div className="archive-flow-book-author">{book.author}</div>
                  </div>
                </div>
              ))}
            </div>

            <p className="archive-flow-note">
              Reading progress and timestamps are included with each selected book.
            </p>
          </div>

          <div className="archive-flow-footer">
            <button
              className="btn-primary"
              disabled={selectedKeys.size === 0}
              onClick={handleExport}
            >
              Back Up {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ''}
            </button>
          </div>
        </>
      )}

      {phase === 'exporting' && (
        <div className="archive-flow-content archive-flow-status">
          <p>Creating backup...</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="archive-flow-content archive-flow-status">
          <h2>Backup created successfully.</h2>
          <p>
            Your browser's save dialog should appear shortly.
          </p>
          <button className="btn-primary" onClick={onBack}>
            Back to Settings
          </button>
        </div>
      )}
    </div>
  )
}
