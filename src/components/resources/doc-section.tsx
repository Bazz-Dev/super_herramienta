'use client'

import { useState, useTransition } from 'react'
import { DOC_TYPE, DOC_TYPE_LABELS, type DocTypeId } from '@/lib/resources/labels'
import { deleteDocument } from '@/app/(app)/recursos/tecnicos/actions'

type Doc = {
  id: string
  type: string
  label: string | null
  fileUrl: string
  expiryDate: Date | null
  notes: string | null
  uploadedAt: Date
}

function expiryStatus(d: Date | null): 'ok' | 'warn' | 'expired' | null {
  if (!d) return null
  const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'warn'
  return 'ok'
}

const EXPIRY_BADGE: Record<string, string> = {
  ok: 'bg-green-100 text-green-700',
  warn: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
}

function formatDate(d: Date | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DocSection({ technicianId, initial }: { technicianId: string; initial: Doc[] }) {
  const [docs, setDocs] = useState<Doc[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Form state
  const [type, setType] = useState<DocTypeId>('contrato')
  const [label, setLabel] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"]')
    const file = fileInput?.files?.[0]
    if (!file) { setError('Selecciona un archivo.'); return }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    fd.append('label', label)
    fd.append('expiryDate', expiryDate)
    fd.append('notes', notes)

    setUploading(true)
    try {
      const res = await fetch(`/api/technicians/${technicianId}/documents`, { method: 'POST', body: fd })
      const json = await res.json() as { doc?: Doc; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Error al subir')
      setDocs((prev) => [json.doc!, ...prev])
      form.reset()
      setLabel('')
      setExpiryDate('')
      setNotes('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  function handleDelete(docId: string) {
    if (!confirm('¿Eliminar este documento?')) return
    startTransition(async () => {
      await deleteDocument(docId, technicianId)
      setDocs((prev) => prev.filter((d) => d.id !== docId))
    })
  }

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Documentos
          {docs.length > 0 && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {docs.length}
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-ink hover:bg-brand-600"
        >
          {showForm ? 'Cancelar' : '+ Subir documento'}
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <form onSubmit={handleUpload} className="mb-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tipo *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DocTypeId)}
                className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              >
                {DOC_TYPE.map((t) => (
                  <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nombre personalizado</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej. Examen altura 2026"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Vencimiento</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Archivo (PDF, JPG, PNG — máx. 10 MB) *</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                required
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-ink"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Notas</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones opcionales"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={uploading}
            className="mt-3 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {uploading ? 'Subiendo…' : 'Guardar documento'}
          </button>
        </form>
      )}

      {/* Document list */}
      {docs.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-400">
          Sin documentos. Sube el primero con el botón de arriba.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {docs.map((d) => {
            const status = expiryStatus(d.expiryDate ? new Date(d.expiryDate) : null)
            return (
              <li key={d.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {/* Doc type icon */}
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {d.label || DOC_TYPE_LABELS[d.type as DocTypeId] || d.type}
                    </p>
                    <p className="text-xs text-gray-500">
                      {DOC_TYPE_LABELS[d.type as DocTypeId] ?? d.type}
                      {d.notes && <> · {d.notes}</>}
                    </p>
                    {d.expiryDate && (
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${EXPIRY_BADGE[status!]}`}>
                        {status === 'expired' ? 'Vencido' : status === 'warn' ? 'Por vencer' : 'Vigente'} · {formatDate(d.expiryDate ? new Date(d.expiryDate) : null)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Ver
                  </a>
                  <a
                    href={d.fileUrl}
                    download
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Descargar
                  </a>
                  <button
                    onClick={() => handleDelete(d.id)}
                    disabled={isPending}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-60"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
