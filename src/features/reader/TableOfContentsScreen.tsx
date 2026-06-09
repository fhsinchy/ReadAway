import { useEffect, useState } from 'react'
import type { TocItem } from '@/services/ReaderService'
import { getTableOfContents } from '@/services/ReaderService'

interface Props {
  onBack: () => void
}

export function TableOfContentsScreen({ onBack }: Props) {
  const [toc, setToc] = useState<TocItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const items = await getTableOfContents()
      setToc(items)
      setLoading(false)
    }
    load()
  }, [])

  const handleChapterClick = (href: string) => {
    // Navigate to the chapter in the reader
    // We need access to the rendition. Since this is a separate screen,
    // we save the target and let the reader pick it up.
    sessionStorage.setItem('readaway-toc-target', href)
    onBack()
  }

  return (
    <div className="toc-screen">
      <header className="toc-header">
        <button className="btn-text" onClick={onBack}>
          ← Back
        </button>
        <h2 className="toc-title">Contents</h2>
        <div style={{ width: 50 }} />
      </header>

      <div className="toc-list">
        {loading ? (
          <p className="toc-loading">Loading...</p>
        ) : toc.length === 0 ? (
          <p className="toc-empty">No table of contents available.</p>
        ) : (
          toc.map((item, i) => (
            <TocItemRenderer
              key={item.id || i}
              item={item}
              onClick={handleChapterClick}
            />
          ))
        )}
      </div>
    </div>
  )
}

function TocItemRenderer({
  item,
  onClick,
  depth = 0,
}: {
  item: TocItem
  onClick: (href: string) => void
  depth?: number
}) {
  return (
    <>
      <button
        className="toc-item"
        style={{ paddingLeft: 16 + depth * 16 }}
        onClick={() => onClick(item.href)}
      >
        {item.label}
      </button>
      {item.subitems?.map((sub, i) => (
        <TocItemRenderer
          key={sub.id || i}
          item={sub}
          onClick={onClick}
          depth={depth + 1}
        />
      ))}
    </>
  )
}
