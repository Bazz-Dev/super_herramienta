'use client'

import { useState, useEffect } from 'react'

interface Props {
  primary: string
  slug: string
}

type Step = 'idle' | 'prompt' | 'requesting' | 'subscribing' | 'done' | 'denied' | 'unsupported'

const DISMISSED_UNTIL_KEY = 'pw-push-dismissed-until'
const DISMISS_MS = 7 * 24 * 3600_000 // 7 days

export function PortalPushPrompt({ primary, slug }: Props) {
  const [step, setStep] = useState<Step>('idle')

  async function doSubscribe(reg?: ServiceWorkerRegistration) {
    setStep('subscribing')
    try {
      const r = reg ?? await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY!
      const sub = await r.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setStep('done')
      setTimeout(() => setStep('idle'), 3000)
    } catch {
      setStep('idle')
    }
  }

  async function ensureSubscribed() {
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) return // already subscribed
      await doSubscribe(reg)
    } catch {}
  }

  useEffect(() => {
    // Only show if SW + push supported, not already dismissed/granted
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }
    if (Notification.permission === 'granted') {
      void ensureSubscribed() // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    if (Notification.permission === 'denied') return
    const until = localStorage.getItem(DISMISSED_UNTIL_KEY)
    if (until && Date.now() < Number(until)) return
    // Show prompt after a short delay
    const t = setTimeout(() => setStep('prompt'), 2500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEnable() {
    setStep('requesting')
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      await doSubscribe()
    } else if (perm === 'denied') {
      setStep('denied')
      setTimeout(() => setStep('idle'), 4000)
    } else {
      setStep('idle')
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + DISMISS_MS))
    setStep('idle')
  }

  if (step === 'idle' || step === 'unsupported') return null

  if (step === 'done') {
    return (
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 12, padding: '10px 18px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        zIndex: 9999, fontSize: 13, color: '#15803d', fontWeight: 600,
        maxWidth: 'calc(100vw - 32px)',
      }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3.5 9l3.5 4L14.5 5" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Notificaciones activadas
      </div>
    )
  }

  if (step === 'denied') {
    return (
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: '#fff7ed', border: '1px solid #fed7aa',
        borderRadius: 12, padding: '10px 18px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        zIndex: 9999, fontSize: 13, color: '#92400e', fontWeight: 500,
        maxWidth: 'calc(100vw - 32px)',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L14.5 13H1.5L8 1.5z" fill="#f59e0b"/><path d="M8 6v3.5M8 11.5v.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
        Para activarlas luego, ve a Configuración del navegador.
      </div>
    )
  }

  // prompt banner
  const isLoading = step === 'requesting' || step === 'subscribing'
  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: '#fff', border: `1px solid rgba(0,0,0,0.10)`,
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
      zIndex: 9999, maxWidth: 'min(380px, calc(100vw - 24px))', width: '100%',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2a4 4 0 00-4 4v4l-1.5 2.5h11L14 10V6a4 4 0 00-4-4z" fill="rgba(255,255,255,0.9)"/>
          <path d="M8 15a2 2 0 004 0" fill="rgba(255,255,255,0.9)"/>
          <circle cx="15" cy="5" r="3" fill="#22c55e"/>
        </svg>
      </div>
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111', lineHeight: 1.3, marginBottom: 3 }}>
          Activar notificaciones
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.4 }}>
          Te avisamos cuando tu solicitud cambia de estado.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={handleEnable}
            disabled={isLoading}
            style={{
              flex: 1, background: primary, color: '#fff',
              border: 'none', borderRadius: 8, padding: '8px 14px',
              fontSize: 12, fontWeight: 700, cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {isLoading ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                  <path d="M6 1.5A4.5 4.5 0 0110.5 6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Activando…
              </>
            ) : 'Activar'}
          </button>
          <button
            onClick={dismiss}
            style={{
              background: '#f5f5f5', color: '#555',
              border: 'none', borderRadius: 8, padding: '8px 12px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buf = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i)
  return buf
}
