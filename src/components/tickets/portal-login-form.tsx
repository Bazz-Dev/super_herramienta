'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function PortalLoginForm({ slug, primaryColor }: { slug: string; primaryColor: string }) {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) { setError('Correo o contraseña incorrectos.'); return }
    router.push(`/portal/${slug}/tickets`)
    router.refresh()
  }

  const base: React.CSSProperties = {
    width: '100%', borderRadius: '9px',
    border: '1.5px solid rgba(24,19,14,0.15)', background: '#fff',
    padding: '11px 14px', fontSize: '14px', color: '#18130e',
    fontFamily: 'Inter, sans-serif', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(24,19,14,0.55)', marginBottom: '6px' }}>
          Correo electrónico
        </label>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          required autoComplete="email" placeholder="correo@empresa.cl"
          style={base}
          onFocus={e => { e.currentTarget.style.borderColor = primaryColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${primaryColor}22` }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(24,19,14,0.15)'; e.currentTarget.style.boxShadow = 'none' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(24,19,14,0.55)', marginBottom: '6px' }}>
          Contraseña
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
            required autoComplete="current-password" placeholder="••••••••"
            style={{ ...base, paddingRight: '42px' }}
            onFocus={e => { e.currentTarget.style.borderColor = primaryColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${primaryColor}22` }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(24,19,14,0.15)'; e.currentTarget.style.boxShadow = 'none' }}
          />
          <button type="button" onClick={() => setShowPw(!showPw)} style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(24,19,14,0.35)', fontSize: '14px', lineHeight: 1,
          }}>
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '8px', padding: '10px 14px',
        }}>
          <span>⚠️</span>
          <p style={{ fontSize: '13px', color: '#b91c1c', fontWeight: '500', margin: 0 }}>{error}</p>
        </div>
      )}

      <button type="submit" disabled={loading} style={{
        width: '100%', padding: '12px',
        background: primaryColor, color: '#fff',
        border: 'none', borderRadius: '9px',
        fontSize: '14px', fontWeight: '700',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'Inter, sans-serif',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      }}>
        {loading ? 'Ingresando…' : 'Ingresar al portal →'}
      </button>
    </form>
  )
}
