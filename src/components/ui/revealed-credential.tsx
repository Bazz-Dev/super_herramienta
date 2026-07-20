'use client'

import { useState } from 'react'

interface Props {
  email: string
  username?: string | null
  password: string
  onDismiss: () => void
}

// Muestra una contraseña recién generada UNA sola vez — nunca se persiste en
// texto plano en ningún lado (ni logs ni tabla), solo vive en la respuesta de
// la action que la generó. Reutilizado por cuentas de técnico y de portal.
export function RevealedCredential({ email, username, password, onDismiss }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const lines = [`Email: ${email}`, username ? `Usuario: ${username}` : null, `Contraseña: ${password}`]
      .filter(Boolean)
      .join('\n')
    await navigator.clipboard.writeText(lines)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <span aria-hidden>🔑</span> Contraseña generada — no se volverá a mostrar
      </p>
      <dl className="mb-2 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-gray-500">Email</dt>
          <dd className="font-medium text-ink">{email}</dd>
        </div>
        {username && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-500">Usuario</dt>
            <dd className="font-medium text-ink">{username}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-gray-500">Password</dt>
          <dd className="font-mono font-semibold text-ink">{password}</dd>
        </div>
      </dl>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
        >
          {copied ? '✓ Copiado' : 'Copiar credenciales'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
        >
          Listo, la guardé
        </button>
      </div>
    </div>
  )
}
