'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  primaryColor: string
  dark?: boolean  // kept for compat; login page now uses light form
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}`
}

const LS_KEY = (slug: string) => `portal_remember_${slug}`

export function PortalLoginForm({ slug, primaryColor, dark = false }: Props) {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const rgb = hexToRgb(primaryColor)

  // Restore remembered email on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY(slug))
      if (saved) { setEmail(saved); setRemember(true) }
    } catch { /* localStorage not available */ }
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (remember) { localStorage.setItem(LS_KEY(slug), email) }
      else          { localStorage.removeItem(LS_KEY(slug)) }
    } catch { /* ignore */ }

    const res = await signIn('credentials', { login: email, password, redirect: false })
    setLoading(false)
    if (res?.error) { setError('Correo o contraseña incorrectos.'); return }
    router.push(`/portal/${slug}/dashboard`)
    router.refresh()
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px',
    color: dark ? 'rgba(255,255,255,0.5)' : '#4b4540',
  }

  const inputBase: React.CSSProperties = {
    width: '100%', borderRadius: '9px',
    border: dark ? '1px solid rgba(255,255,255,0.13)' : '1.5px solid #e0ddd8',
    background: dark ? 'rgba(255,255,255,0.07)' : '#fff',
    padding: '12px 14px', fontSize: '14px',
    color: dark ? 'rgba(255,255,255,0.9)' : '#18130e',
    fontFamily: 'Inter, system-ui, sans-serif', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    caretColor: primaryColor,
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = primaryColor
    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${rgb}, 0.15)`
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.13)' : '#e0ddd8'
    e.currentTarget.style.boxShadow = 'none'
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelStyle}>Correo electrónico</label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          required autoComplete="email" placeholder="correo@empresa.cl"
          style={inputBase} onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      <div>
        <label style={labelStyle}>Contraseña</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            required autoComplete="current-password" placeholder="••••••••"
            style={{ ...inputBase, paddingRight: '44px' }} onFocus={onFocus} onBlur={onBlur}
          />
          <button
            type="button" onClick={() => setShowPw(v => !v)}
            aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: dark ? 'rgba(255,255,255,0.35)' : '#b0a89f',
              lineHeight: 1, padding: 2, display: 'flex', alignItems: 'center',
            }}
          >
            {showPw ? (
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M1 1l15 15M6.9 6.9A2 2 0 0110.1 10.1"/><path d="M14.4 12a8.2 8.2 0 01-5.9 2.5C4.5 14.5 1.5 11 1.5 8.5c0-1.3.6-2.7 1.6-3.8"/>
                <path d="M4.4 4.2A8.2 8.2 0 018.5 2.5C12.5 2.5 15.5 6 15.5 8.5c0 1-.4 2.1-1 3"/>
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M1.5 8.5C3 5.5 5.5 3 8.5 3s5.5 2.5 7 5.5c-1.5 3-4 5.5-7 5.5S3 11.5 1.5 8.5z"/>
                <circle cx="8.5" cy="8.5" r="2.3"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Remember me */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
        fontSize: '13px', color: dark ? 'rgba(255,255,255,0.42)' : '#8c857e',
        userSelect: 'none',
      }}>
        <input
          type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
          style={{ accentColor: primaryColor, width: 14, height: 14, cursor: 'pointer', flexShrink: 0 }}
        />
        Recordar sesión
      </label>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: dark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
          border: `1px solid ${dark ? 'rgba(220,38,38,0.25)' : '#fecaca'}`,
          borderRadius: '8px', padding: '10px 14px',
        }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>⚠️</span>
          <p style={{ fontSize: '13px', color: dark ? '#f87171' : '#b91c1c', fontWeight: 500, margin: 0 }}>{error}</p>
        </div>
      )}

      <button
        type="submit" disabled={loading}
        style={{
          width: '100%', padding: '14px',
          background: loading ? `rgba(${rgb}, 0.7)` : primaryColor,
          color: '#fff', border: 'none', borderRadius: '9px',
          fontSize: '14px', fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          transition: 'opacity 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginTop: '4px', letterSpacing: '0.1px',
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
              borderRadius: '50%', display: 'inline-block',
              animation: 'plspin 0.7s linear infinite',
            }} />
            Ingresando…
          </>
        ) : (
          <>Ingresar al portal →</>
        )}
      </button>

      <div style={{ textAlign: 'center', marginTop: 2 }}>
        <a
          href="mailto:soporte@ingegarchile.cl?subject=Recuperar%20acceso%20portal"
          style={{
            fontSize: '12px', color: dark ? 'rgba(255,255,255,0.3)' : '#b0a89f',
            textDecoration: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = primaryColor; e.currentTarget.style.textDecoration = 'underline' }}
          onMouseLeave={e => { e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.3)' : '#b0a89f'; e.currentTarget.style.textDecoration = 'none' }}
        >
          ¿Olvidaste tu contraseña?
        </a>
      </div>

      <style>{`@keyframes plspin { to { transform: rotate(360deg) } }`}</style>
    </form>
  )
}
