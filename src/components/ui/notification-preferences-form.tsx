'use client'

import { useEffect, useState, useTransition } from 'react'
import { getMyNotificationPreferences, updateMyNotificationPreferences, type NotificationPrefsView } from '@/lib/notifications/actions'

// App interna (staff) -- Tailwind, ver frontend.md. Gemelo inline-styled:
// src/components/tickets/portal-notification-preferences-form.tsx.
export function NotificationPreferencesForm() {
  const [prefs, setPrefs] = useState<NotificationPrefsView | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getMyNotificationPreferences().then(setPrefs)
  }, [])

  function toggleAll(v: boolean) {
    if (!prefs) return
    setPrefs({ ...prefs, allEnabled: v })
    setSaved(false)
  }
  function toggleEvent(key: string, v: boolean) {
    if (!prefs) return
    setPrefs({ ...prefs, events: prefs.events.map(e => e.key === key ? { ...e, enabled: v } : e) })
    setSaved(false)
  }
  function save() {
    if (!prefs) return
    startTransition(async () => {
      await updateMyNotificationPreferences({
        allEnabled: prefs.allEnabled,
        overrides: Object.fromEntries(prefs.events.map(e => [e.key, e.enabled])),
      })
      setSaved(true)
    })
  }

  if (!prefs) return <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-400">Cargando…</div>

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">Notificaciones</h2>
      <p className="mt-1 text-xs text-gray-500">Elige qué eventos quieres recibir en la app y por push.</p>

      <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3">
        <span className="text-sm font-medium text-ink">Activar todas las notificaciones</span>
        <input type="checkbox" checked={prefs.allEnabled} onChange={e => toggleAll(e.target.checked)} className="h-4 w-4 accent-brand" />
      </label>

      <div className={`mt-3 space-y-1 ${!prefs.allEnabled ? 'opacity-40' : ''}`}>
        {prefs.events.map(e => (
          <label key={e.key} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            <div className="min-w-0">
              <p className="text-sm text-gray-700">{e.label}</p>
              {e.description && <p className="text-xs text-gray-400">{e.description}</p>}
            </div>
            <input type="checkbox" checked={e.enabled} disabled={!prefs.allEnabled}
              onChange={ev => toggleEvent(e.key, ev.target.checked)} className="h-4 w-4 shrink-0 accent-brand" />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={isPending} className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90 disabled:opacity-50">
          {isPending ? 'Guardando…' : 'Guardar preferencias'}
        </button>
        {saved && <span className="text-xs text-green-600">✓ Guardado</span>}
      </div>
    </div>
  )
}
