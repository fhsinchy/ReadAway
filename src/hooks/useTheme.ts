import { useState, useCallback, useEffect } from 'react'
import type { Theme } from '@/types'

const THEME_STORAGE_KEY = 'readaway-theme'
const FONT_SIZE_STORAGE_KEY = 'readaway-font-size'

const DEFAULT_FONT_SIZE = 16

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    if (stored === 'light' || stored === 'dark' || stored === 'black') {
      return stored
    }
    return getSystemTheme() === 'dark' ? 'dark' : 'light'
  })

  const [fontSize, setFontSizeState] = useState<number>(() => {
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
    return stored ? parseInt(stored, 10) : DEFAULT_FONT_SIZE
  })

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(THEME_STORAGE_KEY, t)
  }, [])

  const setFontSize = useCallback((size: number) => {
    const clamped = Math.max(12, Math.min(28, size))
    setFontSizeState(clamped)
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(clamped))
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--reader-font-size',
      `${fontSize}px`,
    )
  }, [fontSize])

  return { theme, setTheme, fontSize, setFontSize }
}
