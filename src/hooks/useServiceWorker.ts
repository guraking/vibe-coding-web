import { useState, useEffect, useCallback } from 'react'

const SW_URL = `${import.meta.env.BASE_URL}sw.js`
const SW_SCOPE = import.meta.env.BASE_URL

export function useServiceWorker() {
  // On second+ page loads, controller is already set synchronously
  const [ready, setReady] = useState(() =>
    typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller
  )

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Already controlled (second+ visit)
    if (navigator.serviceWorker.controller) {
      setReady(true)
    }

    // On first visit: SW activates → clients.claim() → controllerchange fires
    const onControllerChange = () => {
      if (navigator.serviceWorker.controller) setReady(true)
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // Register (no-op if already registered)
    navigator.serviceWorker
      .register(SW_URL, { scope: SW_SCOPE })
      .catch(err => console.error('[SW] registration failed:', err))

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const sendFiles = useCallback((fileMap: Record<string, string>): Promise<void> => {
    return new Promise((resolve, reject) => {
      const sw = navigator.serviceWorker?.controller
      if (!sw) { reject(new Error('SW not active')); return }
      const channel = new MessageChannel()
      channel.port1.onmessage = e => (e.data?.ok ? resolve() : reject(new Error('SW error')))
      sw.postMessage({ type: 'SET_FILES', files: fileMap }, [channel.port2])
    })
  }, [])

  return { ready, sendFiles }
}
