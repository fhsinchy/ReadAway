import { useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function usePwaUpdate() {
  const {
    needRefresh: [updateAvailable, setUpdateAvailable],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })

  const applyUpdate = useCallback(() => {
    void updateServiceWorker(true)
  }, [updateServiceWorker])

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false)
  }, [setUpdateAvailable])

  return {
    updateAvailable,
    applyUpdate,
    dismissUpdate,
  }
}

export type PwaUpdateControls = ReturnType<typeof usePwaUpdate>
