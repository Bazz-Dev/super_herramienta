'use client'
import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_KEY ?? ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function PushProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const registerSW = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // Listen for navigate messages from SW (notification click)
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'navigate' && e.data?.href) {
          router.push(e.data.href)
        }
      })

      // Auto-subscribe if permission already granted
      if (Notification.permission === 'granted') {
        const existing = await reg.pushManager.getSubscription()
        if (!existing) await subscribe(reg)
      }
    } catch (e) {
      console.warn('SW registration failed:', e)
    }
  }, [router])

  useEffect(() => { registerSW() }, [registerSW])

  return <>{children}</>
}

async function subscribe(reg: ServiceWorkerRegistration) {
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
    })
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
  } catch (e) {
    console.warn('Push subscribe failed:', e)
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  const reg = await navigator.serviceWorker.ready
  await subscribe(reg)
  return true
}
