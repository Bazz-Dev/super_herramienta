'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  primaryColor: string
  dark?: boolean
}

export function PortalLoginForm({ slug, primaryColor, dark = false }: Props) {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) { setError('Correo o contraseña incorrectos.'); return }
    router.push(`/portal/${slug}/dashboard`)
    router.refresh()
  }

  const rgb = hexToRgb(primaryColor)

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px',
    color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(24,19,14,0.55)',
  }

  const inputBase: React.CSSProperties = {
    width: '100%', borderRadius: '8px',
    border: dark ? '1px solid rgba(255,255,255,0.12)' : '1.5px solid rgba(24,19,14,0.15)',
    background: dark ? 'rgba(255,255,255,0.07)' : '#fff',
    padding: '11px 14px', fontSize: '14px',
    color: dark ? 'rgba(255,255,255,0.9)' : '#18130e',
    fontFamily: 'Inter, sans-serif', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    caretColor: primaryColor,
  }

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = primaryColor
    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(${rgb}, 0.18)`
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.12)' : 'rgba(24,19,14,0.15)'
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
            type="button" onClick={() => setShowPw(!showPw)}
            aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            style={{
              position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(24,19,14,0.35)',
              fontSize: '15px', lineHeight: 1, padding: 2,
            }}
          >
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: dark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
          border: `1px solid ${dark ? 'rgba(220,38,38,0.25)' : '#fecaca'}`,
          borderRadius: '8px', padding: '10px 14px',
        }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <p style={{ fontSize: '13px', color: dark ? '#f87171' : '#b91c1c', fontWeight: 500, margin: 0 }}>{error}</p>
        </div>
      )}

      <button
        type="submit" disabled={loading}
        style={{
          width: '100%', padding: '13px',
          background: primaryColor, color: '#fff',
          border: 'none', borderRadius: '9px',
          fontSize: '14px', fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          opacity: loading ? 0.7 : 1,
          transition: 'opacity 0.15s, transform 0.1s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          marginTop: '4px',
        }}
      >
        {loading ? (
          <>
            <span style={{
              width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff',
              borderRadius: '50%', display: 'inline-block',
              animation: 'plspin 0.7s linear infinite',
            }} />
            Ingresando…
          </>
        ) : 'Ingresar'}
      </button>

      <style>{`@keyframes plspin { to { transform: rotate(360deg) } }`}</style>
    </form>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}
