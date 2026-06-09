interface Props {
  onBack: () => void
}

export function ExportBooksScreen({ onBack }: Props) {
  return (
    <div>
      <h1>Export Books</h1>
      <button onClick={onBack}>Back</button>
    </div>
  )
}
