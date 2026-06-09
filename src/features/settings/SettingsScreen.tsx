interface Props {
  onBack: () => void
}

export function SettingsScreen({ onBack }: Props) {
  return (
    <div>
      <h1>Settings</h1>
      <button onClick={onBack}>Back</button>
    </div>
  )
}
