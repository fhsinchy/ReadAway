import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [dismissedThisSession, setDismissedThisSession] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Don't show immediately — will be triggered by user action
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const triggerInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) return false

    const result = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowPrompt(false)

    return result.outcome === 'accepted'
  }, [deferredPrompt])

  const showInstallPrompt = useCallback(() => {
    if (!deferredPrompt || dismissedThisSession) return
    setShowPrompt(true)
  }, [deferredPrompt, dismissedThisSession])

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false)
    setDismissedThisSession(true)
  }, [])

  return {
    isInstallable: deferredPrompt !== null,
    showPrompt,
    showInstallPrompt,
    dismissPrompt,
    triggerInstallPrompt,
  }
}
