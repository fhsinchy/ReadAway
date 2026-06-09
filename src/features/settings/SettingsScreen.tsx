import { useState } from 'react'
import './SettingsScreen.css'

interface Props {
  onBack: () => void
  onBackupLibrary: () => void
  onRestoreLibrary: () => void
}

export function SettingsScreen({
  onBack,
  onBackupLibrary,
  onRestoreLibrary,
}: Props) {
  const [installSupported] = useState(
    () => 'BeforeInstallPromptEvent' in window,
  )

  const handleInstall = async () => {
    // The beforeinstallprompt event is captured in the service worker
    // We can trigger it by dispatching an event or showing instructions
    alert(
      'To install ReadAway, use your browser\'s "Add to Home Screen" or "Install" option.',
    )
  }

  return (
    <div className="settings">
      <header className="settings-header">
        <button className="btn-text" onClick={onBack}>
          ← Back
        </button>
        <h2 className="settings-title">Settings</h2>
        <div style={{ width: 50 }} />
      </header>

      <div className="settings-content">
        {/* Library */}
        <section className="settings-section">
          <h3 className="settings-section-title">Library</h3>
          <button className="settings-item" onClick={onBackupLibrary}>
            <span>Back Up Library</span>
            <span className="settings-item-arrow">→</span>
          </button>
          <button className="settings-item" onClick={onRestoreLibrary}>
            <span>Restore Library</span>
            <span className="settings-item-arrow">→</span>
          </button>
        </section>

        {/* Install */}
        {installSupported && (
          <section className="settings-section">
            <h3 className="settings-section-title">Install</h3>
            <button className="settings-item" onClick={handleInstall}>
              <span>Install ReadAway</span>
              <span className="settings-item-arrow">→</span>
            </button>
          </section>
        )}

        {/* About */}
        <section className="settings-section">
          <h3 className="settings-section-title">About</h3>
          <div className="settings-item settings-item-static">
            <span>Version</span>
            <span className="settings-item-value">0.1.0</span>
          </div>
        </section>
      </div>
    </div>
  )
}
