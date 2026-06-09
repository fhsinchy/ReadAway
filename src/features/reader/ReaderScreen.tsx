import type { Book } from '@/types'

interface Props {
  book: Book
  onBack: () => void
  onToc: () => void
}

export function ReaderScreen({ book, onBack }: Props) {
  return (
    <div>
      <h1>Reader: {book.title}</h1>
      <button onClick={onBack}>Back</button>
    </div>
  )
}
