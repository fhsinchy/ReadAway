import Dexie, { type EntityTable } from 'dexie'
import type {
  Book,
  DictionaryEntryRecord,
  DictionaryFormRecord,
  DictionaryRecord,
  PageMap,
  Progress,
} from '@/types'

export class ReadAwayDB extends Dexie {
  books!: EntityTable<Book, 'syncKey'>
  progress!: EntityTable<Progress, 'syncKey'>
  pageMaps!: EntityTable<PageMap, 'key'>
  dictionaries!: EntityTable<DictionaryRecord, 'id'>
  dictionaryEntries!: EntityTable<DictionaryEntryRecord, 'key'>
  dictionaryForms!: EntityTable<DictionaryFormRecord, 'key'>

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

    this.version(3).stores({
      books: '&syncKey, source, importedAt',
      progress: '&syncKey, updatedAt',
      pageMaps: '&key, syncKey, editionHash, algorithmVersion, updatedAt',
      dictionaries: '&id, language, installedAt',
      dictionaryEntries: '&key, dictionaryId, normalizedLemma',
      dictionaryForms: '&key, dictionaryId, normalizedForm',
    })
  }
}

export const db = new ReadAwayDB()
