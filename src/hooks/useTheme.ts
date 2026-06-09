import { useState, useCallback, useEffect } from 'react'
import type { ReaderLayout, Theme } from '@/types'

const THEME_STORAGE_KEY = 'readaway-theme'
const FONT_SIZE_STORAGE_KEY = 'readaway-font-size'
const READER_LAYOUT_STORAGE_KEY = 'readaway-reader-layout'
const PAGE_TURN_ANIMATION_STORAGE_KEY = 'readaway-page-turn-animation'

const DEFAULT_FONT_SIZE = 16
const DEFAULT_READER_LAYOUT: ReaderLayout = 'single'
const DEFAULT_PAGE_TURN_ANIMATION = true

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

  const [readerLayout, setReaderLayoutState] = useState<ReaderLayout>(() => {
    const stored = localStorage.getItem(READER_LAYOUT_STORAGE_KEY)
    if (stored === 'single' || stored === 'two') return stored
    return DEFAULT_READER_LAYOUT
  })

  const [pageTurnAnimation, setPageTurnAnimationState] = useState<boolean>(
    () => {
      const stored = localStorage.getItem(PAGE_TURN_ANIMATION_STORAGE_KEY)
      if (stored === 'on') return true
      if (stored === 'off') return false
      return DEFAULT_PAGE_TURN_ANIMATION
    },
  )

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(THEME_STORAGE_KEY, t)
  }, [])

  const setFontSize = useCallback((size: number) => {
    const clamped = Math.max(12, Math.min(28, size))
    setFontSizeState(clamped)
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(clamped))
  }, [])

  const setReaderLayout = useCallback((layout: ReaderLayout) => {
    setReaderLayoutState(layout)
    localStorage.setItem(READER_LAYOUT_STORAGE_KEY, layout)
  }, [])

  const setPageTurnAnimation = useCallback((enabled: boolean) => {
    setPageTurnAnimationState(enabled)
    localStorage.setItem(
      PAGE_TURN_ANIMATION_STORAGE_KEY,
      enabled ? 'on' : 'off',
    )
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--reader-font-size',
      `${fontSize}px`,
    )
  }, [fontSize])

  return {
    theme,
    setTheme,
    fontSize,
    setFontSize,
    readerLayout,
    setReaderLayout,
    pageTurnAnimation,
    setPageTurnAnimation,
  }
}
