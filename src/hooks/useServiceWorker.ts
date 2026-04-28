import { useState, useEffect, useRef, useCallback } from 'react'

const SW_URL = `${import.meta.env.BASE_URL}sw.js`
const SW_SCOPE = import.meta.env.BASE_URL

export function useServiceWorker() {
  const [ready, setReady] = useState(false)
  const swRef = useRef<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const markReady = (sw: ServiceWorker) => {
      swRef.current = sw
      setReady(true)
    }

    navigator.serviceWorker
      .register(SW_URL, { scope: SW_SCOPE })
      .then(reg => {
        if (reg.active) { markReady(reg.active); return }
        const pending = reg.installing || reg.waiting
        pending?.addEventListener('statechange', (e) => {
          if ((e.target as ServiceWorker).state === 'activated') {
            markReady(reg.active!)
          }
        })
      })
      .catch(err => console.error('[SW] registration failed:', err))

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const ctrl = navigator.serviceWorker.controller
      if (ctrl) markReady(ctrl)
    })
  }, [])

  const sendFiles = useCallback((fileMap: Record<string, string>): Promise<void> => {
    return new Promise((resolve, reject) => {
      const sw = navigator.serviceWorker.controller || swRef.current
      if (!sw) { reject(new Error('SW not active')); return }
      const channel = new MessageChannel()
      channel.port1.onmessage = e => (e.data?.ok ? resolve() : reject(new Error('SW error')))
      sw.postMessage({ type: 'SET_FILES', files: fileMap }, [channel.port2])
    })
  }, [])

  return { ready, sendFiles }
}
