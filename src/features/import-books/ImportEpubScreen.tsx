import { useState, useRef } from 'react'
import type { Book } from '@/types'
import { importEpub } from '@/services/ImportService'
import './ImportEpubScreen.css'

interface Props {
  onBack: () => void
  onReadNow: (book: Book) => void
  onLibrary: () => void
}

type ImportState =
  | { phase: 'choose' }
  | { phase: 'importing' }
  | { phase: 'success'; book: Book }
  | { phase: 'error'; error: 'unsupported_source' | 'invalid_epub' | 'parse_error' }

export function ImportEpubScreen({ onBack, onReadNow, onLibrary }: Props) {
  const [state, setState] = useState<ImportState>({ phase: 'choose' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setState({ phase: 'importing' })

    try {
      const result = await importEpub(file)
      if (result.success && result.book) {
        setState({ phase: 'success', book: result.book })
      } else {
        setState({ phase: 'error', error: result.error || 'invalid_epub' })
      }
    } catch {
      setState({ phase: 'error', error: 'parse_error' })
    }
  }

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="import-epub">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {state.phase === 'choose' && (
        <div className="import-epub-panel">
          <h2>Import EPUB</h2>
          <p>Select an EPUB file from Standard Ebooks or Project Gutenberg.</p>
          <button className="btn-primary" onClick={handleChooseFile}>
            Choose EPUB
          </button>
          <button className="btn-text" onClick={onBack}>
            Back
          </button>
        </div>
      )}

      {state.phase === 'importing' && (
        <div className="import-epub-panel import-epub-importing">
          <p>Importing...</p>
        </div>
      )}

      {state.phase === 'success' && (
        <div className="import-epub-success">
          <h2>Book imported successfully.</h2>
          <p className="import-epub-book-title">{state.book.title}</p>
          <p className="import-epub-book-author">{state.book.author}</p>
          <div className="import-epub-success-actions">
            <button
              className="btn-primary"
              onClick={() => onReadNow(state.book)}
            >
              Read Now
            </button>
            <button className="btn-text" onClick={onLibrary}>
              Back to Library
            </button>
          </div>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="import-epub-error">
          {state.error === 'unsupported_source' && (
            <>
              <h2>Unsupported EPUB</h2>
              <p>
                This version of ReadAway currently supports EPUB books from
                Standard Ebooks and Project Gutenberg only.
              </p>
            </>
          )}
          {(state.error === 'invalid_epub' || state.error === 'parse_error') && (
            <>
              <h2>Invalid EPUB</h2>
              <p>
                The selected file could not be read as a valid EPUB. Please try
                another file.
              </p>
            </>
          )}
          <button className="btn-text" onClick={() => setState({ phase: 'choose' })}>
            Back
          </button>
        </div>
      )}
    </div>
  )
}
