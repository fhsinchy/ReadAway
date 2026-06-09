import type { Book } from '@/types'

export type Screen =
  | { name: 'library' }
  | { name: 'import-epub' }
  | { name: 'reader'; book: Book }
  | { name: 'table-of-contents' }
  | { name: 'settings' }
  | { name: 'export-books' }
  | { name: 'import-archive' }
