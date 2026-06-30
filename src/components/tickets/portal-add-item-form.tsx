'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addPortalTicketItem } from '@/app/portal/[slug]/tickets/actions'

interface Props {
  ticketId: string
  primary: string
  onClose: () => void
}

export function PortalAddItemForm({ ticketId, primary, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Escribe un título para la sub-tarea'); return }
    setError('')
    startTransition(async () => {
      const res = await addPortalTicketItem(ticketId, { title, description: description || undefined })
      if (res.success) {
        router.refresh()
        onClose()
      } else {
        setError(res.error ?? 'No se pudo agregar')
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: '8px',
    border: '1px solid var(--p-bd2)', background: 'var(--p-bg)',
    fontSize: '14px', color: 'var(--p-text)', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
          Título *
        </label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ej: Revisar tubería sala de máquinas"
          style={inputStyle}
          autoFocus
          required
        />
      </div>

      <div>
        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
          Descripción (opcional)
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          placeholder="Detalle adicional…"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {error && <p style={{ fontSize: '13px', color: '#dc2626' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--p-bd2)', background: 'transparent', fontSize: '13px', cursor: 'pointer', color: 'var(--p-t2)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: primary, color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
          {isPending ? 'Agregando…' : '+ Agregar'}
        </button>
      </div>
    </form>
  )
}
