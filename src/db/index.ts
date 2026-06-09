import Dexie, { type EntityTable } from 'dexie'
import type { Book, PageMap, Progress } from '@/types'

export class ReadAwayDB extends Dexie {
  books!: EntityTable<Book, 'syncKey'>
  progress!: EntityTable<Progress, 'syncKey'>
  pageMaps!: EntityTable<PageMap, 'key'>

  constructor() {
    super('ReadAwayDB')

    this.version(1).stores({
      books: '&syncKey, source, importedAt',
      progress: '&syncKey, updatedAt',
    })

    this.version(2).stores({
      books: '&syncKey, source, importedAt',
      progress: '&syncKey, updatedAt',
      pageMaps: '&key, syncKey, editionHash, algorithmVersion, updatedAt',
    })
  }
}

export const db = new ReadAwayDB()
