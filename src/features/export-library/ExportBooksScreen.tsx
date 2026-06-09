import { useState, useEffect, useCallback } from 'react'
import type { Book } from '@/types'
import { db } from '@/db'
import { exportArchive } from '@/services/ExportService'

interface Props {
  onBack: () => void
}

type ExportPhase = 'select' | 'exporting' | 'done'

export function ExportBooksScreen({ onBack }: Props) {
  const [books, setBooks] = useState<Book[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [includeProgress, setIncludeProgress] = useState(true)
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
      const blob = await exportArchive([...selectedKeys], { includeProgress })

      // Trigger browser download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `readaway-export-${Date.now()}.raway`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setPhase('done')
    } catch (err) {
      console.error('Export failed:', err)
      setPhase('select')
    }
  }, [selectedKeys, includeProgress])

  return (
    <div className="export-screen">
      <header className="export-header">
        <button className="btn-text" onClick={onBack}>
          ← Back
        </button>
        <h2 className="export-title">Export Books</h2>
        <div style={{ width: 50 }} />
      </header>

      {phase === 'select' && (
        <>
          <div className="export-content">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className="btn-text" onClick={selectAll}>
                Select All
              </button>
              <button className="btn-text" onClick={deselectAll}>
                Deselect All
              </button>
            </div>

            <div className="export-book-list">
              {books.map((book) => (
                <div key={book.syncKey} className="export-book-item">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(book.syncKey)}
                    onChange={() => toggleBook(book.syncKey)}
                  />
                  <div className="export-book-info">
                    <div className="export-book-title">{book.title}</div>
                    <div className="export-book-author">{book.author}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="export-options">
              <div className="export-option">
                <input
                  type="checkbox"
                  id="include-progress"
                  checked={includeProgress}
                  onChange={(e) => setIncludeProgress(e.target.checked)}
                />
                <label htmlFor="include-progress">
                  Include reading progress
                </label>
              </div>
            </div>
          </div>

          <div className="export-footer">
            <button
              className="btn-primary"
              disabled={selectedKeys.size === 0}
              onClick={handleExport}
            >
              Export {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ''}
            </button>
          </div>
        </>
      )}

      {phase === 'exporting' && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <p style={{ color: '#888' }}>Generating archive...</p>
        </div>
      )}

      {phase === 'done' && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <h2>Archive created successfully.</h2>
          <p style={{ color: '#666', marginTop: 8 }}>
            Your browser's save dialog should appear shortly.
          </p>
          <button className="btn-primary" onClick={onBack} style={{ marginTop: 16 }}>
            Back to Library
          </button>
        </div>
      )}
    </div>
  )
}
