import { useState, useCallback, useEffect } from 'react'
import type { Screen } from '@/core/navigation'
import { LibraryScreen } from '@/features/library/LibraryScreen'
import { ImportEpubScreen } from '@/features/import-books/ImportEpubScreen'
import { ImportArchiveScreen } from '@/features/import-books/ImportArchiveScreen'
import { ReaderScreen } from '@/features/reader/ReaderScreen'
import { TableOfContentsScreen } from '@/features/reader/TableOfContentsScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { ExportBooksScreen } from '@/features/export-library/ExportBooksScreen'
import { useAppTheme } from '@/hooks/useAppTheme'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { db } from '@/db'

const ACTIVE_BOOK_KEY = 'readaway-active-book'

export function App() {
  const { appTheme, resolvedAppTheme, setAppTheme } = useAppTheme()
  const pwaInstall = usePwaInstall()
  const [screenStack, setScreenStack] = useState<Screen[]>(() => {
    // Restore reader screen on refresh
    const saved = sessionStorage.getItem(ACTIVE_BOOK_KEY)
    if (saved) {
      return [{ name: 'library' }, { name: 'reader', book: JSON.parse(saved) }]
    }
    return [{ name: 'library' }]
  })

  const currentScreen = screenStack[screenStack.length - 1]

  const push = useCallback((screen: Screen) => {
    setScreenStack((prev) => [...prev, screen])
  }, [])

  const pop = useCallback(() => {
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const replaceTop = useCallback((screen: Screen) => {
    setScreenStack((prev) => [...prev.slice(0, -1), screen])
  }, [])

  // Persist the active book to sessionStorage so a page refresh restores
  // the reader instead of falling back to the library.
  useEffect(() => {
    const readerScreen = [...screenStack].reverse().find((s) => s.name === 'reader')
    if (readerScreen && readerScreen.name === 'reader') {
      sessionStorage.setItem(ACTIVE_BOOK_KEY, JSON.stringify(readerScreen.book))
    } else {
      sessionStorage.removeItem(ACTIVE_BOOK_KEY)
    }
  }, [screenStack])

  // Validate restored book still exists in the database. If it was deleted
  // (e.g. in another tab), fall back to the library.
  useEffect(() => {
    const current = screenStack[screenStack.length - 1]
    if (current.name === 'reader') {
      db.books.get(current.book.syncKey).then((exists) => {
        if (!exists) {
          setScreenStack([{ name: 'library' }])
        }
      })
    }
    // Only run on mount to validate the restored book
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderScreen = () => {
    switch (currentScreen.name) {
      case 'library':
        return (
          <LibraryScreen
            onImportEpub={() => push({ name: 'import-epub' })}
            onOpenBook={(book) => push({ name: 'reader', book })}
            onSettings={() => push({ name: 'settings' })}
            pwaInstall={pwaInstall}
          />
        )
      case 'import-epub':
        return (
          <ImportEpubScreen
            onBack={pop}
            onReadNow={(book) => replaceTop({ name: 'reader', book })}
            onLibrary={() => {
              setScreenStack([{ name: 'library' }])
            }}
          />
        )
      case 'reader':
        return (
          <ReaderScreen
            book={currentScreen.book}
            onBack={pop}
          />
        )
      case 'table-of-contents':
        return <TableOfContentsScreen onBack={pop} />
      case 'settings':
        return (
          <SettingsScreen
            onBack={pop}
            onBackupLibrary={() => push({ name: 'backup-library' })}
            onRestoreLibrary={() => push({ name: 'restore-library' })}
            appTheme={appTheme}
            resolvedAppTheme={resolvedAppTheme}
            onAppThemeChange={setAppTheme}
            pwaInstall={pwaInstall}
          />
        )
      case 'backup-library':
        return <ExportBooksScreen onBack={pop} />
      case 'restore-library':
        return <ImportArchiveScreen onBack={pop} />
      default:
        return <LibraryScreen
          onImportEpub={() => push({ name: 'import-epub' })}
          onOpenBook={(book) => push({ name: 'reader', book })}
          onSettings={() => push({ name: 'settings' })}
          pwaInstall={pwaInstall}
        />
    }
  }

  return (
    <div
      className="app-shell"
      data-app-theme={resolvedAppTheme}
    >
      {renderScreen()}
    </div>
  )
}
