'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { requestPushPermission, pushSupported } from './push-provider'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  read: boolean
  createdAt: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifs.filter((n) => !n.read).length

  async function load() {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) setNotifs(await res.json())
    } catch {}
  }

  async function markRead() {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function enablePush() {
    const ok = await requestPushPermission()
    setPushEnabled(ok)
  }

  useEffect(() => {
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 30_000)
    if (pushSupported()) setPushEnabled(Notification.permission === 'granted')
    return () => clearInterval(id)
  }, [])

  // PWA App Badge — shows unread count as number on home screen icon
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => void; clearAppBadge?: () => void }
    if (unread > 0) nav.setAppBadge?.(unread)
    else nav.clearAppBadge?.()
  }, [unread])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleOpen() {
    setOpen((v) => !v)
    if (!open && unread > 0) markRead()
  }

  const TYPE_ICON: Record<string, string> = {
    ticket_new: '🎫',
    ticket_update: '🔄',
    vehicle_alert: '🚨',
    permission_approved: '✅',
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-gray-100"
        aria-label="Notificaciones"
      >
        <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        {unread === 0 && pushEnabled === false && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" title="Activar notificaciones push" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-ink">Notificaciones</span>
            {pushEnabled === false && (
              <button onClick={enablePush} className="flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition">
                🔔 Activar alertas
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Sin notificaciones</p>
            ) : (
              notifs.map((n) => {
                const content = (
                  <div className={`flex items-start gap-3 px-4 py-3 transition hover:bg-gray-50 ${!n.read ? 'bg-brand/5' : ''}`}>
                    <span className="mt-0.5 text-base">{TYPE_ICON[n.type] ?? '🔔'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink">{n.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        {new Date(n.createdAt).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  </div>
                )
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)}>{content}</Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>

          {notifs.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5 text-center">
              <button onClick={markRead} className="text-xs text-gray-400 hover:text-gray-600">
                Marcar todo como leído
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
