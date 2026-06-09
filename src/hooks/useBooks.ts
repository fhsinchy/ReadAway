import { useState, useEffect, useCallback } from 'react'
import type { Book } from '@/types'
import { db } from '@/db'

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  const loadBooks = useCallback(async () => {
    setLoading(true)
    const all = await db.books.orderBy('importedAt').reverse().toArray()
    setBooks(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false

    db.books.orderBy('importedAt').reverse().toArray().then((all) => {
      if (cancelled) return
      setBooks(all)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const deleteBook = useCallback(async (syncKey: string) => {
    await db.books.delete(syncKey)
    await db.progress.delete(syncKey)
    await loadBooks()
  }, [loadBooks])

  return { books, loading, loadBooks, deleteBook }
}

export async function getBooksWithProgress(): Promise<
  (Book & { progress?: number })[]
> {
  const all = await db.books.orderBy('importedAt').reverse().toArray()
  const withProgress = await Promise.all(
    all.map(async (book) => {
      const progress = await db.progress.get(book.syncKey)
      return { ...book, progress: progress?.percentage }
    }),
  )
  return withProgress
}
