interface Props {
  onBack: () => void
}

export function TableOfContentsScreen({ onBack }: Props) {
  return (
    <div>
      <h1>Table of Contents</h1>
      <button onClick={onBack}>Back</button>
    </div>
  )
}
