import { useCallback, useEffect, useState } from 'react'
import type { AppResolvedTheme, AppThemeSetting } from '@/types'

const APP_THEME_STORAGE_KEY = 'readaway-app-theme'

function getSystemAppTheme(): AppResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function getStoredAppTheme(): AppThemeSetting {
  const stored = localStorage.getItem(APP_THEME_STORAGE_KEY)
  if (stored === 'system' || stored === 'light' || stored === 'dark') {
    return stored
  }
  return 'dark'
}

function resolveAppTheme(setting: AppThemeSetting): AppResolvedTheme {
  return setting === 'system' ? getSystemAppTheme() : setting
}

export function useAppTheme() {
  const [appTheme, setAppThemeState] =
    useState<AppThemeSetting>(getStoredAppTheme)
  const [resolvedAppTheme, setResolvedAppTheme] = useState<AppResolvedTheme>(
    () => resolveAppTheme(getStoredAppTheme()),
  )

  const setAppTheme = useCallback((value: AppThemeSetting) => {
    setAppThemeState(value)
    localStorage.setItem(APP_THEME_STORAGE_KEY, value)
    setResolvedAppTheme(resolveAppTheme(value))
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setResolvedAppTheme(resolveAppTheme(appTheme))
    }

    handleChange()
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [appTheme])

  useEffect(() => {
    document.documentElement.dataset.appTheme = resolvedAppTheme
    document.documentElement.style.colorScheme = resolvedAppTheme
  }, [resolvedAppTheme])

  return { appTheme, resolvedAppTheme, setAppTheme }
}
