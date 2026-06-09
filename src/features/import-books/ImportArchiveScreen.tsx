interface Props {
  onBack: () => void
}

export function ImportArchiveScreen({ onBack }: Props) {
  return (
    <div>
      <h1>Import Archive</h1>
      <button onClick={onBack}>Back</button>
    </div>
  )
}
