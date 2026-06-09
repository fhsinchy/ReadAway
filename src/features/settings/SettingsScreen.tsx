import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
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
  const { theme, setTheme, fontSize, setFontSize } = useTheme()
  const [appearanceOpen, setAppearanceOpen] = useState(false)
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

        {/* Appearance */}
        <section className="settings-section">
          <h3 className="settings-section-title">Appearance</h3>
          <button
            className="settings-item"
            onClick={() => setAppearanceOpen(true)}
          >
            <span>Appearance</span>
            <span className="settings-item-value">
              {theme.charAt(0).toUpperCase() + theme.slice(1)} · {fontSize}px
            </span>
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

      {/* Appearance Sheet */}
      {appearanceOpen && (
        <div
          className="appearance-overlay"
          onClick={() => setAppearanceOpen(false)}
        >
          <div
            className="appearance-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="appearance-title">Appearance</h3>

            <div className="appearance-section">
              <h4>Theme</h4>
              <div className="theme-options">
                {(
                  [
                    { key: 'light', label: 'Light' },
                    { key: 'dark', label: 'Dark' },
                    { key: 'black', label: 'Black' },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`theme-btn ${theme === key ? 'theme-btn-active' : ''}`}
                    onClick={() => setTheme(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="appearance-section">
              <h4>Font Size</h4>
              <div className="font-size-control">
                <button
                  className="btn-text"
                  onClick={() => setFontSize(fontSize - 1)}
                >
                  −
                </button>
                <span className="font-size-value">{fontSize}</span>
                <button
                  className="btn-text"
                  onClick={() => setFontSize(fontSize + 1)}
                >
                  +
                </button>
              </div>
            </div>

            <button
              className="btn-primary appearance-close"
              onClick={() => setAppearanceOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
