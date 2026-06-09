import { useState, useCallback } from 'react'
import type { Screen } from '@/core/navigation'
import { LibraryScreen } from '@/features/library/LibraryScreen'
import { ImportEpubScreen } from '@/features/import-books/ImportEpubScreen'
import { ImportArchiveScreen } from '@/features/import-books/ImportArchiveScreen'
import { ReaderScreen } from '@/features/reader/ReaderScreen'
import { TableOfContentsScreen } from '@/features/reader/TableOfContentsScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { ExportBooksScreen } from '@/features/export-library/ExportBooksScreen'

export function App() {
  const [screenStack, setScreenStack] = useState<Screen[]>([{ name: 'library' }])

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

  const renderScreen = () => {
    switch (currentScreen.name) {
      case 'library':
        return (
          <LibraryScreen
            onImportEpub={() => push({ name: 'import-epub' })}
            onOpenBook={(book) => push({ name: 'reader', book })}
            onExport={() => push({ name: 'export-books' })}
            onSettings={() => push({ name: 'settings' })}
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
            onImportArchive={() => push({ name: 'import-archive' })}
          />
        )
      case 'export-books':
        return <ExportBooksScreen onBack={pop} />
      case 'import-archive':
        return <ImportArchiveScreen onBack={pop} />
      default:
        return <LibraryScreen
          onImportEpub={() => push({ name: 'import-epub' })}
          onOpenBook={(book) => push({ name: 'reader', book })}
          onExport={() => push({ name: 'export-books' })}
          onSettings={() => push({ name: 'settings' })}
        />
    }
  }

  return <div style={{ height: '100dvh' }}>{renderScreen()}</div>
}
