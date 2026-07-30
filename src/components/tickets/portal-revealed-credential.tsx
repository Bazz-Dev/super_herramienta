'use client'

import { useState } from 'react'

interface Props {
  email: string
  username?: string | null
  password: string
  onDismiss: () => void
}

// Equivalente inline-styled de src/components/ui/revealed-credential.tsx —
// esa versión usa Tailwind, prohibido en el portal (.claude/rules/frontend.md).
// Misma idea: la contraseña generada solo vive en la respuesta de la action,
// se muestra una vez y nunca se persiste en texto plano en ningún lado.
export function PortalRevealedCredential({ email, username, password, onDismiss }: Props) {
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
    <div style={{ borderRadius: 10, border: '1.5px solid #fcd34d', background: '#fffbeb', padding: 14 }}>
      <p style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#92400e' }}>
        <span aria-hidden>🔑</span> Contraseña generada — no se volverá a mostrar
      </p>
      <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ width: 76, flexShrink: 0, color: '#78350f' }}>Email</span>
          <span style={{ fontWeight: 600, color: '#18130e' }}>{email}</span>
        </div>
        {username && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ width: 76, flexShrink: 0, color: '#78350f' }}>Usuario</span>
            <span style={{ fontWeight: 600, color: '#18130e' }}>{username}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ width: 76, flexShrink: 0, color: '#78350f' }}>Password</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: '#18130e' }}>{password}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={copy}
          style={{ borderRadius: 7, background: '#d97706', padding: '7px 14px', fontSize: 12, fontWeight: 700, color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {copied ? '✓ Copiado' : 'Copiar credenciales'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{ borderRadius: 7, border: '1.5px solid #fcd34d', background: 'transparent', padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#92400e', cursor: 'pointer' }}
        >
          Listo, la guardé
        </button>
      </div>
    </div>
  )
}
