'use client'

import { useEffect, useState, useTransition } from 'react'
import { getMyNotificationPreferences, updateMyNotificationPreferences, type NotificationPrefsView } from '@/lib/notifications/actions'

const BORDER = 'rgba(24,19,14,0.15)'
const T2 = 'rgba(24,19,14,0.55)'
const T3 = 'rgba(24,19,14,0.40)'

// Gemelo inline-styled de src/components/ui/notification-preferences-form.tsx
// (app interna, Tailwind) -- regla dura del portal, ver frontend.md. Mismos
// server actions compartidos (src/lib/notifications/actions.ts).
export function PortalNotificationPreferencesForm({ primary, bg, textColor }: { primary: string; bg: string; textColor: string }) {
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

  if (!prefs) return <p style={{ fontSize: 13, color: T3 }}>Cargando…</p>

  return (
    <div className="pcard" style={{ padding: 18, marginTop: 14 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: textColor }}>Notificaciones</h2>
      <p style={{ marginTop: 4, fontSize: 12, color: T3 }}>Elige qué eventos quieres recibir en la app y por push.</p>

      <label style={{ marginTop: 14, display: 'flex', minHeight: 44, cursor: 'pointer', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 8, border: `1px solid ${BORDER}`, background: bg, padding: '0 12px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: textColor }}>Activar todas las notificaciones</span>
        <input type="checkbox" checked={prefs.allEnabled} onChange={e => toggleAll(e.target.checked)} style={{ width: 16, height: 16, accentColor: primary, cursor: 'pointer' }} />
      </label>

      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2, opacity: prefs.allEnabled ? 1 : 0.4 }}>
        {prefs.events.map(e => (
          <label key={e.key} style={{ display: 'flex', minHeight: 44, cursor: 'pointer', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 8, padding: '4px 8px' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, color: textColor, margin: 0 }}>{e.label}</p>
              {e.description && <p style={{ fontSize: 11, color: T3, margin: '2px 0 0' }}>{e.description}</p>}
            </div>
            <input type="checkbox" checked={e.enabled} disabled={!prefs.allEnabled}
              onChange={ev => toggleEvent(e.key, ev.target.checked)} style={{ width: 16, height: 16, flexShrink: 0, accentColor: primary, cursor: 'pointer' }} />
          </label>
        ))}
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={save} disabled={isPending} className="pbtn pbtn-primary" style={{ minHeight: 40 }}>
          {isPending ? 'Guardando…' : 'Guardar preferencias'}
        </button>
        {saved && <span style={{ fontSize: 12, color: '#16a34a' }}>✓ Guardado</span>}
      </div>
    </div>
  )
}
