import { useState, useRef, useCallback } from 'react'
import {
  previewRestore,
  importFromArchive,
  type RestorePreview,
  type RestorePreviewItem,
} from '@/services/ExportService'

interface Props {
  onBack: () => void
}

type ImportPhase = 'choose' | 'preview' | 'importing' | 'done' | 'error'

export function ImportArchiveScreen({ onBack }: Props) {
  const [phase, setPhase] = useState<ImportPhase>('choose')
  const [preview, setPreview] = useState<RestorePreview | null>(null)
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
      const nextPreview = await previewRestore(file)
      setPreview(nextPreview)
      setSelectedKeys(
        new Set(
          nextPreview.items
            .filter((item) => item.defaultSelected)
            .map((item) => item.entry.syncKey),
        ),
      )
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
      setErrorMsg(err instanceof Error ? err.message : 'Restore failed')
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
        <h2 className="export-title">Restore Library</h2>
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
          <h2>Restore Library</h2>
          <p style={{ color: '#666', marginTop: 8, marginBottom: 16 }}>
            Select a ReadAway backup to restore books and reading progress.
          </p>
          <button className="btn-primary" onClick={handleChooseFile}>
            Choose Backup
          </button>
        </div>
      )}

      {phase === 'preview' && preview && (
        <>
          <div className="export-content">
            <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              {preview.manifest.books.length} book{preview.manifest.books.length !== 1 ? 's' : ''} in backup
            </p>

            {preview.items.some((item) => item.status === 'local_newer') && (
              <div className="restore-warning">
                <h3>Newer progress on this device</h3>
                <p>
                  These books are unchecked so your newer local reading position is kept.
                </p>
              </div>
            )}

            <div className="export-book-list">
              {preview.items.map((item) => (
                <div
                  key={item.entry.syncKey}
                  className={`export-book-item ${item.status === 'local_newer' ? 'restore-book-local-newer' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(item.entry.syncKey)}
                    onChange={() => toggleBook(item.entry.syncKey)}
                  />
                  <div className="export-book-info">
                    <div className="export-book-title">{item.entry.title}</div>
                    <div className="export-book-author">{item.entry.author}</div>
                    <RestoreItemStatus item={item} />
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
              Restore Selected
              {selectedKeys.size > 0 ? ` (${selectedKeys.size})` : ''}
            </button>
          </div>
        </>
      )}

      {phase === 'importing' && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <p style={{ color: '#888' }}>Restoring library...</p>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <h2>Library restored successfully.</h2>
          <p style={{ color: '#666', marginTop: 8 }}>
            {result.imported} restored{result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
          </p>
          <button className="btn-primary" onClick={onBack} style={{ marginTop: 16 }}>
            Back to Settings
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="export-content" style={{ textAlign: 'center', paddingTop: 64 }}>
          <h2>Restore Failed</h2>
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

function RestoreItemStatus({ item }: { item: RestorePreviewItem }) {
  const archiveProgress = item.archiveProgress
  const localProgress = item.localProgress

  return (
    <div className="restore-book-status">
      <span>{statusText(item)}</span>
      {item.editionMismatch && (
        <span>
          Different EPUB version. Restoring replaces the local copy and its progress.
        </span>
      )}
      {(archiveProgress || localProgress) && (
        <span>
          {localProgress
            ? `This device: ${formatProgress(localProgress.percentage)}${formatDate(localProgress.updatedAt)}`
            : 'This device: no progress'}
          {' · '}
          {archiveProgress
            ? `Backup: ${formatProgress(archiveProgress.percentage)}${formatDate(archiveProgress.updatedAt)}`
            : 'Backup: no progress'}
        </span>
      )}
    </div>
  )
}

function statusText(item: RestorePreviewItem): string {
  switch (item.status) {
    case 'new':
      return 'New book.'
    case 'archive_newer':
      return 'Backup has newer progress.'
    case 'local_newer':
      return 'This device has newer progress.'
    case 'archive_no_progress':
      return 'Backup has no progress for this book.'
    case 'same_progress':
      return item.localBook ? 'Already in library.' : 'Ready to restore.'
  }
}

function formatProgress(progress: number): string {
  return `${Math.round(progress)}%`
}

function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  return `, ${new Date(timestamp).toLocaleDateString()}`
}
