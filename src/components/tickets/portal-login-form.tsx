'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function PortalLoginForm({ slug, primaryColor }: { slug: string; primaryColor: string }) {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: `/portal/${slug}/tickets`,
    })
    setLoading(false)
    if (res?.error) {
      setError('Correo o contraseña incorrectos.')
      return
    }
    router.push(`/portal/${slug}/tickets`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1 opacity-70">Correo electrónico</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:ring-2"
          style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
          placeholder="correo@empresa.cl"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 opacity-70">Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:ring-2"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-500/20 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: primaryColor, color: '#111' }}
      >
        {loading ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
