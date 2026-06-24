'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPortalTicket } from '@/app/portal/[slug]/tickets/actions'
import { URGENCY_LABEL, type TicketUrgencyId } from '@/lib/tickets/labels'

interface Props {
  slug: string
  clientId: string
  createdById: string
  branches: { id: string; name: string; city: string | null }[]
  theme: { primary: string; text: string; bg: string }
}

export function PortalNewTicketForm({ slug, clientId, createdById, branches, theme }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

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

  const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white/10 border-white/20'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: theme.text }}>Sucursal *</label>
        <select name="branchId" required className={inputClass} style={{ color: theme.text }}>
          <option value="">Selecciona una sucursal</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: theme.text }}>Urgencia *</label>
        <select name="urgency" defaultValue="no_urgente" className={inputClass} style={{ color: theme.text }}>
          {(Object.keys(URGENCY_LABEL) as TicketUrgencyId[]).map((u) => (
            <option key={u} value={u}>{URGENCY_LABEL[u]}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: theme.text }}>Categoría</label>
        <input type="text" name="category" placeholder="Ej: Climatización, Electricidad..." className={inputClass} style={{ color: theme.text }} />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: theme.text }}>Título del requerimiento *</label>
        <input type="text" name="title" required placeholder="Resumen breve del problema" className={inputClass} style={{ color: theme.text }} />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1 opacity-70" style={{ color: theme.text }}>Descripción</label>
        <textarea name="description" rows={4} placeholder="Describe el problema con el mayor detalle posible..." className={inputClass} style={{ color: theme.text }} />
      </div>

      {error && <p className="rounded-md bg-red-500/20 px-3 py-2 text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
        style={{ background: theme.primary, color: '#111' }}
      >
        {isPending ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
