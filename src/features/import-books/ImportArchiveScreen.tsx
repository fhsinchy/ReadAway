import { useState, useRef, useCallback } from 'react'
import type { ArchiveManifest } from '@/types'
import { previewArchive, importFromArchive } from '@/services/ExportService'

interface Props {
  onBack: () => void
}

type ImportPhase = 'choose' | 'preview' | 'importing' | 'done' | 'error'

export function ImportArchiveScreen({ onBack }: Props) {
  const [phase, setPhase] = useState<ImportPhase>('choose')
  const [manifest, setManifest] = useState<ArchiveManifest | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<File | null>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      fileRef.current = file
      const m = await previewArchive(file)
      setManifest(m)
      setSelectedKeys(new Set(m.books.map((b) => b.syncKey)))
      setPhase('preview')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid archive')
      setPhase('error')
    }
  }, [])

  const toggleBook = useCallback((syncKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(syncKey)) next.delete(syncKey)
      else next.add(syncKey)
      return next
    })
  }, [])

  const handleImport = useCallback(async () => {
    if (!fileRef.current || selectedKeys.size === 0) return

    setPhase('importing')

    try {
      const res = await importFromArchive(fileRef.current, selectedKeys)
      setResult(res)
      setPhase('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed')
      setPhase('error')
    }
  }, [selectedKeys])

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="export-screen">
      <header className="export-header">
        <button className="btn-text" onClick={onBack}>
          ← Back
        </button>
        <h2 className="export-title">Import Archive</h2>
        <div style={{ width: 50 }} />
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".raway,.zip"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {phase === 'choose' && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <h2>Import Archive</h2>
          <p style={{ color: '#666', marginTop: 8, marginBottom: 16 }}>
            Select a .raway archive to import books.
          </p>
          <button className="btn-primary" onClick={handleChooseFile}>
            Choose Archive
          </button>
        </div>
      )}

      {phase === 'preview' && manifest && (
        <>
          <div className="export-content">
            <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              {manifest.books.length} book{manifest.books.length !== 1 ? 's' : ''} in archive
            </p>

            <div className="export-book-list">
              {manifest.books.map((entry) => (
                <div key={entry.syncKey} className="export-book-item">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(entry.syncKey)}
                    onChange={() => toggleBook(entry.syncKey)}
                  />
                  <div className="export-book-info">
                    <div className="export-book-title">{entry.title}</div>
                    <div className="export-book-author">
                      {entry.author}
                      {entry.hasProgress ? ' · Includes progress' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="export-footer">
            <button
              className="btn-primary"
              disabled={selectedKeys.size === 0}
              onClick={handleImport}
            >
              Import Selected
              {selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}
            </button>
          </div>
        </>
      )}

      {phase === 'importing' && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <p style={{ color: '#888' }}>Importing books...</p>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <h2>Books imported successfully.</h2>
          <p style={{ color: '#666', marginTop: 8 }}>
            {result.imported} imported{result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
          </p>
          <button className="btn-primary" onClick={onBack} style={{ marginTop: 16 }}>
            Back to Library
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <h2>Import Failed</h2>
          <p style={{ color: '#666', marginTop: 8 }}>{errorMsg}</p>
          <button
            className="btn-primary"
            onClick={() => setPhase('choose')}
            style={{ marginTop: 16 }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
