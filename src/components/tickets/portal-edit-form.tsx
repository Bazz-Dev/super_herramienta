'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePortalTicket } from '@/app/portal/[slug]/tickets/actions'

const URGENCY_OPTIONS = [
  { value: 'emergencia', label: 'Emergencia' },
  { value: 'urgencia',   label: 'Urgente' },
  { value: 'no_urgente', label: 'No urgente' },
  { value: 'preventivo', label: 'Preventivo' },
]

interface Props {
  ticketId: string
  initialTitle: string
  initialDescription: string
  initialUrgency: string
  primary: string
  onClose: () => void
}

export function PortalEditForm({ ticketId, initialTitle, initialDescription, initialUrgency, primary, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [urgency, setUrgency] = useState(initialUrgency)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('El título es obligatorio'); return }
    setError('')
    startTransition(async () => {
      const res = await updatePortalTicket(ticketId, { title, description, urgency })
      if (res.success) {
        router.refresh()
        onClose()
      } else {
        setError(res.error ?? 'No se pudo guardar')
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
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
          Título *
        </label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} required />
      </div>

      <div>
        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
          Descripción
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
        />
      </div>

      <div>
        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '6px' }}>
          Urgencia
        </label>
        <select value={urgency} onChange={e => setUrgency(e.target.value)} style={inputStyle}>
          {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && <p style={{ fontSize: '13px', color: '#dc2626' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--p-bd2)', background: 'transparent', fontSize: '13px', cursor: 'pointer', color: 'var(--p-t2)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: primary, color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: isPending ? 0.7 : 1 }}>
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
