'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPortalTicket } from '@/app/portal/[slug]/tickets/actions'

interface Props {
  slug: string
  clientId: string
  createdById: string
  branches: { id: string; name: string; city: string | null }[]
  primary: string
}

const URGENCIES = [
  { value: 'emergencia',  label: 'Emergencia',  desc: 'Servicio afectado, requiere atención inmediata' },
  { value: 'urgencia',    label: 'Urgente',      desc: 'Debe resolverse dentro de 24 horas' },
  { value: 'no_urgente',  label: 'Normal',       desc: 'Sin impacto crítico en operación' },
  { value: 'preventivo',  label: 'Preventivo',   desc: 'Mantención programada o chequeo rutinario' },
]

const CATEGORIES = [
  'Climatización', 'Campana extractora', 'Electricidad', 'Plomería / agua',
  'Refrigeración', 'Gas', 'Estructural / obra civil', 'Equipamiento de cocina',
  'Seguridad / CCTV', 'Iluminación', 'Otro',
]

export function PortalNewTicketForm({ slug, clientId, createdById, branches, primary }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [urgency, setUrgency] = useState('no_urgente')

  const inp: React.CSSProperties = {
    width: '100%', borderRadius: '9px',
    border: '1.5px solid rgba(24,19,14,0.15)', background: 'var(--p-bg)',
    padding: '10px 14px', fontSize: '14px', color: 'var(--p-text)',
    fontFamily: 'Inter, sans-serif', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = primary
    e.currentTarget.style.boxShadow = `0 0 0 3px ${primary}22`
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.currentTarget.style.borderColor = 'rgba(24,19,14,0.15)'
    e.currentTarget.style.boxShadow = 'none'
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('clientId', clientId)
    fd.set('createdById', createdById)
    setError('')
    startTransition(async () => {
      const res = await createPortalTicket(fd)
      if (!res.success) { setError('Error al crear la solicitud. Inténtalo nuevamente.'); return }
      router.push(`/portal/${slug}/tickets/${res.id}`)
    })
  }

  const label = (text: string, required?: boolean) => (
    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(24,19,14,0.55)', marginBottom: '6px' }}>
      {text}{required && <span style={{ color: primary, marginLeft: '3px' }}>*</span>}
    </label>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Sucursal */}
      <div>
        {label('Sucursal', true)}
        <select name="branchId" required style={inp} onFocus={focusStyle} onBlur={blurStyle}>
          <option value="">Selecciona la sucursal afectada…</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>
          ))}
        </select>
      </div>

      {/* Urgencia */}
      <div>
        {label('Nivel de urgencia', true)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {URGENCIES.map(u => (
            <label key={u.value} style={{
              display: 'flex', flexDirection: 'column', gap: '3px',
              padding: '10px 12px', borderRadius: '9px', cursor: 'pointer',
              border: `1.5px solid ${urgency === u.value ? primary : 'rgba(24,19,14,0.15)'}`,
              background: urgency === u.value ? `color-mix(in srgb, ${primary} 8%, white)` : 'var(--p-bg)',
              transition: 'all 0.12s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="radio" name="urgency" value={u.value} checked={urgency === u.value}
                  onChange={() => setUrgency(u.value)} style={{ accentColor: primary, margin: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--p-text)' }}>{u.label}</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--p-t3)', paddingLeft: '18px' }}>{u.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Categoría */}
      <div>
        {label('Categoría del problema')}
        <select name="category" style={inp} onFocus={focusStyle} onBlur={blurStyle}>
          <option value="">Seleccionar categoría (opcional)…</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Título */}
      <div>
        {label('Título del requerimiento', true)}
        <input type="text" name="title" required placeholder="Ej: Aire acondicionado no enfría en tienda 3"
          style={inp} onFocus={focusStyle} onBlur={blurStyle} />
        <p style={{ fontSize: '11px', color: 'var(--p-t3)', marginTop: '5px' }}>Sé específico: equipo afectado + síntoma + ubicación.</p>
      </div>

      {/* Descripción */}
      <div>
        {label('Descripción detallada')}
        <textarea name="description" rows={5}
          placeholder="Describe el problema: ¿cuándo comenzó? ¿qué acciones se tomaron? ¿qué equipos o zonas están afectados?"
          style={{ ...inp, resize: 'vertical', minHeight: '100px' }}
          onFocus={focusStyle} onBlur={blurStyle} />
      </div>

      {/* Comentario del cliente */}
      <div>
        {label('Comentario adicional')}
        <textarea name="clientComment" rows={3}
          placeholder="¿Tienes algún detalle, restricción de horario, o información extra que debamos saber?"
          style={{ ...inp, resize: 'vertical', minHeight: '80px' }}
          onFocus={focusStyle} onBlur={blurStyle} />
        <p style={{ fontSize: '11px', color: 'var(--p-t3)', marginTop: '5px' }}>Opcional — solo visible para ti y el equipo INGEGAR.</p>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span>
          <p style={{ fontSize: '13px', color: '#b91c1c', margin: 0, fontWeight: '500' }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
        <button type="submit" disabled={isPending} style={{
          flex: 1, padding: '12px', background: primary, color: '#fff',
          border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: '700',
          cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1,
          fontFamily: 'Inter, sans-serif', transition: 'opacity 0.15s',
        }}>
          {isPending ? 'Enviando solicitud…' : 'Enviar solicitud →'}
        </button>
        <a href={`/portal/${slug}/tickets`} style={{
          padding: '12px 18px', background: 'var(--p-bg)', color: 'var(--p-t2)',
          border: '1.5px solid rgba(24,19,14,0.15)', borderRadius: '9px',
          fontSize: '14px', fontWeight: '600', textDecoration: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          Cancelar
        </a>
      </div>
    </form>
  )
}
