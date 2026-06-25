'use client'

import { useState, useTransition } from 'react'
import { updateTicketFields, updateTicketStatus, addTicketComment } from '@/app/(app)/tickets/actions'
import { ALL_STATUSES, STATUS_LABEL, type TicketStatusId } from '@/lib/tickets/labels'

type Item = { id: string; title: string; status: string; description: string | null }
type Doc  = { id: string; name: string; fileUrl: string; uploadedAt: Date }

interface Props {
  ticket: {
    id: string
    status: string
    otNumber: string | null
    assignedToId: string | null
    estimatedDate: string | null
    workSummary: string | null
    internalNotes: string | null
    driveFolderUrl: string | null
    showToClient: boolean
    items: Item[]
    documents: Doc[]
  }
  staffUsers: { id: string; name: string }[]
  technicians: { id: string; name: string }[]
}

export function TicketControls({ ticket, staffUsers, technicians }: Props) {
  const [isPending, startTransition] = useTransition()
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [otNumber, setOtNumber] = useState(ticket.otNumber ?? '')
  const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? '')
  const [estimatedDate, setEstimatedDate] = useState(ticket.estimatedDate ?? '')
  const [workSummary, setWorkSummary] = useState(ticket.workSummary ?? '')
  const [showToClient, setShowToClient] = useState(ticket.showToClient)
  const [saved, setSaved] = useState(false)

  function handleSaveFields() {
    startTransition(async () => {
      await updateTicketFields(ticket.id, {
        otNumber: otNumber || undefined,
        assignedToId: assignedToId || null,
        estimatedDate: estimatedDate || undefined,
        workSummary: workSummary || undefined,
        showToClient,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleStatusChange(newStatus: string) {
    startTransition(async () => { await updateTicketStatus(ticket.id, newStatus) })
  }

  function handleComment() {
    if (!comment.trim()) return
    startTransition(async () => {
      await addTicketComment(ticket.id, comment.trim(), isInternal)
      setComment('')
    })
  }

  const closedStatuses = ['resuelto', 'cancelado', 'fusionado']
  const isClosed = closedStatuses.includes(ticket.status)

  return (
    <div className="space-y-4">
      {/* Assignment + OT */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Asignación y control</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Técnico asignado</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              disabled={isClosed}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50"
            >
              <option value="">Sin asignar</option>
              {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">N° OT</label>
            <input
              type="text"
              value={otNumber}
              onChange={(e) => setOtNumber(e.target.value)}
              disabled={isClosed}
              placeholder="OT-0001"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fecha estimada</label>
            <input
              type="date"
              value={estimatedDate}
              onChange={(e) => setEstimatedDate(e.target.value)}
              disabled={isClosed}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s as TicketStatusId]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs text-gray-500 mb-1">Resumen del trabajo (visible al cliente al cerrar)</label>
          <textarea
            value={workSummary}
            onChange={(e) => setWorkSummary(e.target.value)}
            rows={3}
            placeholder="Describe el trabajo realizado..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
        </div>

        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={showToClient}
              onClick={() => setShowToClient(v => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${showToClient ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${showToClient ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-xs text-gray-600">
              {showToClient ? 'Visible en portal cliente' : 'Oculto al cliente'}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveFields}
              disabled={isPending}
              className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {saved && <span className="text-xs text-green-600">✓ Guardado</span>}
          </div>
        </div>
      </div>

      {/* Items */}
      {ticket.items.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Ítems de trabajo
            <span className="ml-2 text-xs text-gray-400">
              {ticket.items.filter(i => i.status === 'resuelto').length}/{ticket.items.length} resueltos
            </span>
          </h3>
          <ul className="space-y-2">
            {ticket.items.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${item.status === 'resuelto' ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'} flex items-center justify-center text-[10px]`}>
                  {item.status === 'resuelto' && '✓'}
                </span>
                <span className={item.status === 'resuelto' ? 'line-through text-gray-400' : 'text-gray-700'}>
                  {item.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documents */}
      {ticket.documents.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Documentos en Drive</h3>
          <ul className="space-y-2">
            {ticket.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate max-w-[60%]">📎 {doc.name}</span>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand hover:underline"
                >
                  Abrir ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Add comment */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Agregar comentario</h3>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Escribe un comentario..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded"
            />
            Nota interna (no visible al cliente)
          </label>
          <button
            type="button"
            onClick={handleComment}
            disabled={isPending || !comment.trim()}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
          >
            {isInternal ? '🔒 Guardar nota' : 'Publicar comentario'}
          </button>
        </div>
      </div>
    </div>
  )
}
