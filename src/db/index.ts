import Dexie, { type EntityTable } from 'dexie'
import type { Book, Progress } from '@/types'

export class ReadAwayDB extends Dexie {
  books!: EntityTable<Book, 'syncKey'>
  progress!: EntityTable<Progress, 'syncKey'>

  constructor() {
    super('ReadAwayDB')

    this.version(1).stores({
      books: '&syncKey, source, importedAt',
      progress: '&syncKey, updatedAt',
    })
  }
}

export const db = new ReadAwayDB()
