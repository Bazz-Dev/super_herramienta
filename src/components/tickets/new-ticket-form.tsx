'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTicket } from '@/app/(app)/tickets/actions'
import { URGENCY_LABEL, type TicketUrgencyId } from '@/lib/tickets/labels'

type Branch = { id: string; name: string }
type Client = { id: string; name: string; branches: Branch[] }

interface Props {
  clients: Client[]
  users: { id: string; name: string }[]
  createdById: string
}

function buildCode(urgency: string, branchName: string): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const urgMap: Record<string, string> = { emergencia: 'EM', urgencia: 'UR', no_urgente: 'RQ', preventivo: 'PR' }
  const code = urgMap[urgency] ?? 'RQ'
  const suc = branchName.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
  return `${yy}${mm}${dd}-JB-${code}1-${suc}`
}

export function NewTicketForm({ clients, users, createdById }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [branchId, setBranchId] = useState('')
  const [urgency, setUrgency] = useState<TicketUrgencyId>('no_urgente')
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  const selectedClient = clients.find(c => c.id === clientId)
  const branches = selectedClient?.branches ?? []

  // Auto-build ticket code preview
  const branchName = branches.find(b => b.id === branchId)?.name ?? 'SUCURSAL'
  const codePreview = buildCode(urgency, branchName)

  function handleClientChange(id: string) {
    setClientId(id)
    setBranchId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !clientId) {
      setError('Título y cliente son obligatorios')
      return
    }
    setError(null)

    const fd = new FormData()
    fd.set('ticketCode', codePreview)
    fd.set('title', title.trim())
    fd.set('description', description)
    fd.set('urgency', urgency)
    fd.set('category', category)
    fd.set('clientId', clientId)
    if (branchId) fd.set('branchId', branchId)
    if (assignedToId) fd.set('assignedToId', assignedToId)
    if (internalNotes.trim()) fd.set('internalNotes', internalNotes.trim())

    startTransition(async () => {
      const result = await createTicket(null, fd)
      if (result?.success && result.id) {
        router.push(`/tickets/${result.id}`)
      } else {
        setError('Error al crear el ticket')
      }
    })
  }

  const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Client + Branch */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Cliente *</label>
          <select value={clientId} onChange={e => handleClientChange(e.target.value)} className={inputCls} required>
            <option value="">Seleccionar cliente…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Sucursal</label>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className={inputCls}>
            <option value="">Sin sucursal específica</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {/* Urgency + Category */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Urgencia</label>
          <select value={urgency} onChange={e => setUrgency(e.target.value as TicketUrgencyId)} className={inputCls}>
            {(['emergencia', 'urgencia', 'no_urgente', 'preventivo'] as TicketUrgencyId[]).map(u => (
              <option key={u} value={u}>{URGENCY_LABEL[u]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Categoría</label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="Ej: Climatización, Eléctrica…"
            className={inputCls}
          />
        </div>
      </div>

      {/* Code preview */}
      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
        <span className="text-xs text-gray-400">Código generado: </span>
        <span className="font-mono text-xs text-gray-600">{codePreview}</span>
      </div>

      {/* Title */}
      <div>
        <label className={labelCls}>Título *</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Describe brevemente el problema…"
          className={inputCls}
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Descripción / Observaciones</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="Detalle del problema, equipo afectado, acciones previas…"
          className={inputCls}
        />
      </div>

      {/* Assign + Internal notes */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Asignar a técnico</label>
          <select value={assignedToId} onChange={e => setAssignedToId(e.target.value)} className={inputCls}>
            <option value="">Sin asignar</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Notas internas (solo INGEGAR)</label>
        <textarea
          value={internalNotes}
          onChange={e => setInternalNotes(e.target.value)}
          rows={2}
          placeholder="Contexto interno, observaciones del equipo…"
          className={inputCls}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? 'Creando…' : 'Crear ticket'}
        </button>
        <a href="/tickets" className="text-sm text-gray-500 hover:text-gray-700 transition">
          Cancelar
        </a>
      </div>
    </form>
  )
}
