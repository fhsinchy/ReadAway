import { useEffect, useState } from 'react'
import type {
  AppResolvedTheme,
  AppThemeSetting,
  DictionaryCatalogItem,
  DictionaryRecord,
} from '@/types'
import type { PwaInstallControls } from '@/hooks/usePwaInstall'
import {
  getDefaultDictionaryCatalogItem,
  getInstalledDictionary,
  installDefaultDictionary,
  removeDictionary,
  type DictionaryInstallProgress,
} from '@/services/DictionaryService'
import './SettingsScreen.css'

interface Props {
  onBack: () => void
  onBackupLibrary: () => void
  onRestoreLibrary: () => void
  appTheme: AppThemeSetting
  resolvedAppTheme: AppResolvedTheme
  onAppThemeChange: (theme: AppThemeSetting) => void
  pwaInstall: PwaInstallControls
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
  pwaInstall,
}: Props) {
  const [installSupported] = useState(() => 'onbeforeinstallprompt' in window)
  const [dictionaryCatalogItem, setDictionaryCatalogItem] =
    useState<DictionaryCatalogItem | null>(null)
  const [installedDictionary, setInstalledDictionary] =
    useState<DictionaryRecord | null>(null)
  const [dictionaryBusy, setDictionaryBusy] = useState(false)
  const [dictionaryProgress, setDictionaryProgress] =
    useState<DictionaryInstallProgress | null>(null)
  const [dictionaryError, setDictionaryError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDictionaryState() {
      const installed = await getInstalledDictionary()
      if (!cancelled) {
        setInstalledDictionary(installed)
      }

      try {
        const catalogItem = await getDefaultDictionaryCatalogItem()
        if (!cancelled) {
          setDictionaryCatalogItem(catalogItem)
        }
      } catch (err) {
        console.debug('[SettingsScreen] Dictionary catalog unavailable:', err)
      }
    }

    loadDictionaryState()

    return () => {
      cancelled = true
    }
  }, [])

  const handleInstall = async () => {
    if (pwaInstall.isInstallable) {
      await pwaInstall.triggerInstallPrompt()
      return
    }

    alert(
      'To install ReadAway, use your browser\'s "Add to Home Screen" or "Install" option.',
    )
  }

  const handleInstallDictionary = async () => {
    setDictionaryBusy(true)
    setDictionaryError(null)
    try {
      const installed = await installDefaultDictionary(setDictionaryProgress)
      setInstalledDictionary(installed)
    } catch (err) {
      console.error('[SettingsScreen] Dictionary install failed:', err)
      setDictionaryError('Dictionary download failed. Check your connection and try again.')
    } finally {
      setDictionaryBusy(false)
      setDictionaryProgress(null)
    }
  }

  const handleRemoveDictionary = async () => {
    if (!installedDictionary) return

    setDictionaryBusy(true)
    setDictionaryError(null)
    try {
      await removeDictionary(installedDictionary.id)
      setInstalledDictionary(null)
    } catch (err) {
      console.error('[SettingsScreen] Dictionary removal failed:', err)
      setDictionaryError('Dictionary could not be removed.')
    } finally {
      setDictionaryBusy(false)
    }
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

        {/* Dictionary */}
        <section className="settings-section">
          <h3 className="settings-section-title">Dictionary</h3>
          <div className="settings-item settings-item-stacked settings-item-static">
            <div className="settings-item-heading">
              <span>English Dictionary</span>
              <span className="settings-item-value">
                {installedDictionary ? 'Installed' : 'Not Installed'}
              </span>
            </div>
            <div className="settings-dictionary-meta">
              <span>
                {installedDictionary?.sourceName ??
                  dictionaryCatalogItem?.sourceName ??
                  'Open English WordNet'}
              </span>
              <span>
                {installedDictionary?.sourceVersion ??
                  dictionaryCatalogItem?.sourceVersion ??
                  '2025'}
              </span>
              <span>
                {formatBytes(
                  installedDictionary?.sizeBytes ??
                    dictionaryCatalogItem?.sizeBytes ??
                    0,
                )}
              </span>
              <span>
                {installedDictionary?.license ??
                  dictionaryCatalogItem?.license ??
                  'CC-BY 4.0'}
              </span>
              <span>
                {installedDictionary?.attribution ??
                  dictionaryCatalogItem?.attribution ??
                  'Open English WordNet contributors'}
              </span>
            </div>
            {dictionaryProgress && (
              <div className="settings-progress">
                <div
                  className="settings-progress-bar"
                  style={{ width: `${dictionaryProgress.percent}%` }}
                />
                <span>
                  {formatDictionaryStage(dictionaryProgress.stage)}{' '}
                  {dictionaryProgress.percent}%
                </span>
              </div>
            )}
            {dictionaryError && (
              <p className="settings-error">{dictionaryError}</p>
            )}
            <button
              className={`${installedDictionary ? 'btn-danger' : 'btn-primary'} settings-inline-button`}
              disabled={
                dictionaryBusy || (!installedDictionary && !dictionaryCatalogItem)
              }
              onClick={
                installedDictionary
                  ? handleRemoveDictionary
                  : handleInstallDictionary
              }
            >
              {installedDictionary ? 'Remove' : 'Download'}
            </button>
          </div>
        </section>

        {/* Install */}
        {installSupported && !pwaInstall.isInstalled && (
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

function formatDictionaryStage(stage: DictionaryInstallProgress['stage']): string {
  switch (stage) {
    case 'downloading':
      return 'Downloading'
    case 'verifying':
      return 'Verifying'
    case 'installing':
      return 'Installing'
    case 'complete':
      return 'Installed'
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return 'Size unavailable'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
