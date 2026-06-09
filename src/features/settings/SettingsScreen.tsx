import { useState } from 'react'
import type { AppResolvedTheme, AppThemeSetting } from '@/types'
import './SettingsScreen.css'

interface Props {
  onBack: () => void
  onBackupLibrary: () => void
  onRestoreLibrary: () => void
  appTheme: AppThemeSetting
  resolvedAppTheme: AppResolvedTheme
  onAppThemeChange: (theme: AppThemeSetting) => void
}

const APP_THEME_OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
] as const

export function SettingsScreen({
  onBack,
  onBackupLibrary,
  onRestoreLibrary,
  appTheme,
  resolvedAppTheme,
  onAppThemeChange,
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
        {/* Appearance */}
        <section className="settings-section">
          <h3 className="settings-section-title">Appearance</h3>
          <div className="settings-item settings-item-stacked settings-item-static">
            <div className="settings-item-heading">
              <span>App Theme</span>
              <span className="settings-item-value">
                {resolvedAppTheme === 'dark' ? 'Dark' : 'Light'}
              </span>
            </div>
            <div className="settings-segmented" role="radiogroup">
              {APP_THEME_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  className={`settings-segment ${appTheme === option.key ? 'settings-segment-active' : ''}`}
                  type="button"
                  role="radio"
                  aria-checked={appTheme === option.key}
                  onClick={() => onAppThemeChange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

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
