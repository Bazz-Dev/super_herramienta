'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface Notif {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  read: boolean
  createdAt: string
}

const BORDER = 'rgba(24,19,14,0.15)'
const T3 = 'rgba(24,19,14,0.40)'

// Gemelo inline-styled de src/components/ui/notification-bell.tsx (app
// interna, Tailwind) -- regla dura del portal, ver frontend.md. Mismo
// endpoint (/api/notifications, ya genérico por sesión -- no hace falta uno
// nuevo para el portal) y misma lógica de leídas/no leídas + "marcar todo
// como leído" (FASE 6 del brief). Antes de esto el portal no tenía ninguna
// vista de notificaciones en la app -- los avisos al cliente solo llegaban
// por push (si el navegador lo permitía) y se perdían si no.
export function PortalNotificationBell({ primary, cardBg, textColor }: { primary: string; cardBg: string; textColor: string }) {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const unread = notifs.filter(n => !n.read).length

  async function load() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setNotifs(await res.json())
    } catch { /* ignore */ }
  }
  async function markRead() {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde el servidor, no hay valor sincrónico disponible antes del mount
    void load()
    const id = setInterval(() => { if (!document.hidden) void load() }, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    setOpen(v => !v)
    if (!open && unread > 0) markRead()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={handleOpen} aria-label="Notificaciones" style={{
        position: 'relative', display: 'flex', height: 44, width: 44, alignItems: 'center', justifyContent: 'center',
        borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', color: T3,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', right: -1, top: -1, display: 'flex', height: 16, width: 16, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#ef4444', fontSize: 9, fontWeight: 700, color: '#fff' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 44, zIndex: 200, width: 320, borderRadius: 12, border: `1px solid ${BORDER}`, background: cardBg, boxShadow: '0 12px 30px rgba(0,0,0,0.18)' }}>
          <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '10px 14px' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>Notificaciones</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <p style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: T3 }}>Sin notificaciones</p>
            ) : (
              notifs.map(n => {
                const row = (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: !n.read ? `${primary}0d` : 'transparent' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: textColor, margin: 0 }}>{n.title}</p>
                      <p style={{ fontSize: 12, color: T3, margin: '2px 0 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</p>
                      <p style={{ fontSize: 10, color: T3, margin: '2px 0 0' }}>
                        {new Date(n.createdAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.read && <span style={{ marginTop: 6, height: 8, width: 8, flexShrink: 0, borderRadius: '50%', background: primary }} />}
                  </div>
                )
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)} style={{ display: 'block', textDecoration: 'none' }}>{row}</Link>
                ) : <div key={n.id}>{row}</div>
              })
            )}
          </div>
          {notifs.length > 0 && (
            <div style={{ borderTop: `1px solid ${BORDER}`, padding: '8px 14px', textAlign: 'center' }}>
              <button onClick={markRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: T3 }}>Marcar todo como leído</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
