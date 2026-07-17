'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { tecnicoAdvanceStatus, tecnicoAddComment } from '@/app/mi-panel/tickets/actions'
import { TECNICO_TRANSITIONS, STATUS_LABEL, type TicketStatusId } from '@/lib/tickets/labels'
import { Spinner } from '@/components/ui/spinner'

interface Doc { id: string; name: string; fileUrl: string; mimeType: string | null }

interface Props {
  ticketId: string
  status: string
  documents: Doc[]
}

const NEXT_LABEL: Record<string, string> = {
  en_ejecucion: 'Iniciar ejecución →',
  esperando_aprobacion: 'Enviar a aprobación →',
}

export function TecnicoTicketActions({ ticketId, status, documents }: Props) {
  const router = useRouter()
  // Transiciones separadas (G24): una acción en curso no bloquea a las demás
  const [statusPending, startStatus] = useTransition()
  const [commentPending, startComment] = useTransition()
  const [comment, setComment] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const nextStatuses = TECNICO_TRANSITIONS[status] ?? []

  function advance(newStatus: string) {
    setError('')
    startStatus(async () => {
      const res = await tecnicoAdvanceStatus(ticketId, newStatus)
      if (!res.success) setError(res.error ?? 'No se pudo actualizar.')
    })
  }

  function submitComment() {
    if (!comment.trim()) return
    setError('')
    startComment(async () => {
      const res = await tecnicoAddComment(ticketId, comment.trim(), false)
      if (res.success) setComment('')
      else setError(res.error ?? 'No se pudo comentar.')
    })
  }

  async function upload(file: File) {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await fetch(`/api/tickets/${ticketId}/documents`, { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Error ${res.status} al subir el archivo.`)
      } else {
        router.refresh()
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Avance de estado permitido */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Registrar avance</h2>
        {nextStatuses.length === 0 ? (
          <p className="text-sm text-gray-400">Este ticket no admite cambios de estado desde tu rol.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => advance(s)}
                disabled={statusPending}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
              >
                {statusPending ? <Spinner /> : null}
                {NEXT_LABEL[s] ?? STATUS_LABEL[s as TicketStatusId]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comentario de atención */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Registrar atención</h2>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          placeholder="Describe la atención realizada..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={submitComment}
            disabled={commentPending || !comment.trim()}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
          >
            {commentPending ? 'Guardando…' : 'Registrar atención'}
          </button>
        </div>
      </div>

      {/* Evidencia (fotos / documentos) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Evidencia</h2>
        <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 ${uploading ? 'pointer-events-none opacity-40' : ''}`}>
          {uploading ? 'Subiendo…' : '📎 Adjuntar foto o documento'}
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
          />
        </label>
        {documents.length > 0 && (
          <ul className="mt-3 space-y-1">
            {documents.map(d => (
              <li key={d.id} className="text-sm text-gray-600">📄 {d.name}</li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  )
}
