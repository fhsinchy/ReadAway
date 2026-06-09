import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplayMode() {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissedThisSession, setDismissedThisSession] = useState(false)
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplayMode)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      if (isStandaloneDisplayMode()) {
        setDeferredPrompt(null)
        setShowPrompt(false)
        setIsInstalled(true)
        return
      }

      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstalled(false)
    }

    const handleInstalled = () => {
      setDeferredPrompt(null)
      setShowPrompt(false)
      setIsInstalled(true)
    }

    const displayMode = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => {
      setIsInstalled(isStandaloneDisplayMode())
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', handleInstalled)
    displayMode.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', handleInstalled)
      displayMode.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  const triggerInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) return false

    await deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowPrompt(false)

    return result.outcome === 'accepted'
  }, [deferredPrompt])

  const showInstallPrompt = useCallback(() => {
    if (!deferredPrompt || dismissedThisSession || isInstalled) return
    setShowPrompt(true)
  }, [deferredPrompt, dismissedThisSession, isInstalled])

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false)
    setDismissedThisSession(true)
  }, [])

  return {
    isInstallable: deferredPrompt !== null,
    isInstalled,
    showPrompt,
    showInstallPrompt,
    dismissPrompt,
    triggerInstallPrompt,
  }
}

export type PwaInstallControls = ReturnType<typeof usePwaInstall>
