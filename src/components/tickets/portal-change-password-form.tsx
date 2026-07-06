'use client'

import { useActionState, useState } from 'react'
import { changePortalPassword } from '@/app/portal/[slug]/cuenta/actions'

type State = { error?: string; success?: boolean }

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}`
}

export function PortalChangePasswordForm({ slug: _slug, primary }: { slug: string; primary: string }) {
  const [state, action, pending] = useActionState<State, FormData>(changePortalPassword, {})
  const [showPw, setShowPw] = useState(false)
  const rgb = hexToRgb(primary)

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #e0ddd8', borderRadius: 12,
    padding: '24px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#4b4540', marginBottom: 6,
  }
  const input: React.CSSProperties = {
    width: '100%', padding: '10px 13px', borderRadius: 8,
    border: '1.5px solid #e0ddd8', fontSize: 14, color: '#18130e',
    fontFamily: 'Inter, sans-serif', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = primary
    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${rgb}, 0.15)`
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#e0ddd8'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <div style={card}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#18130e', marginBottom: 4 }}>
        Cambiar contraseña
      </h2>
      <p style={{ fontSize: 13, color: '#8c857e', marginBottom: 20 }}>
        Elige una contraseña segura de al menos 8 caracteres.
      </p>

      {state.success ? (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
          padding: '14px 16px', fontSize: 14, color: '#166534', fontWeight: 600,
        }}>
          ✓ Contraseña actualizada correctamente.
        </div>
      ) : (
        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>Contraseña actual</label>
            <input
              name="currentPassword" type={showPw ? 'text' : 'password'}
              required autoComplete="current-password"
              style={input} onFocus={onFocus} onBlur={onBlur}
            />
          </div>
          <div>
            <label style={label}>Nueva contraseña</label>
            <input
              name="newPassword" type={showPw ? 'text' : 'password'}
              required minLength={8} autoComplete="new-password"
              style={input} onFocus={onFocus} onBlur={onBlur}
            />
          </div>
          <div>
            <label style={label}>Confirmar nueva contraseña</label>
            <input
              name="confirmPassword" type={showPw ? 'text' : 'password'}
              required autoComplete="new-password"
              style={input} onFocus={onFocus} onBlur={onBlur}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4b4540', cursor: 'pointer' }}>
            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)}
              style={{ accentColor: primary, width: 14, height: 14 }} />
            Mostrar contraseñas
          </label>

          {state.error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, color: '#b91c1c',
            }}>
              {state.error}
            </div>
          )}

          <button
            type="submit" disabled={pending}
            style={{
              padding: '12px', background: pending ? `rgba(${rgb},0.6)` : primary,
              color: '#fff', border: 'none', borderRadius: 9,
              fontSize: 14, fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif', marginTop: 4,
            }}
          >
            {pending ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </form>
      )}
    </div>
  )
}
