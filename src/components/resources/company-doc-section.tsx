'use client'

import { useState } from 'react'
import { COMPANY_DOC_TYPE, COMPANY_DOC_TYPE_LABELS, type CompanyDocTypeId } from '@/lib/resources/labels'
import { FilePreviewButton } from '@/components/ui/file-preview-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'

type Doc = {
  id: string
  type: string
  label: string | null
  fileUrl: string
  uploadedAt: Date
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Same row/card treatment, selection language and preview pattern as
// doc-section.tsx (técnicos) — the two only diverge where the data genuinely
// does: company docs have no fixed slots (contrato/carnet) and no expiryDate.
export function CompanyDocSection({ initial }: { initial: Doc[] }) {
  const [docs, setDocs] = useState<Doc[]>(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.map((d) => d.id)))
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<CompanyDocTypeId>('reglamento')
  const [label, setLabel] = useState('')
  const [showForm, setShowForm] = useState(false)

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

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

    setUploading(true)
    try {
      const res = await fetch('/api/company-documents', { method: 'POST', body: fd })
      const json = await res.json() as { doc?: Doc; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Error al subir')
      setDocs((prev) => [json.doc!, ...prev])
      setSelected((prev) => new Set(prev).add(json.doc!.id))
      form.reset()
      setLabel('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('¿Eliminar este documento?')) return
    setDeletingId(docId)
    try {
      await fetch(`/api/company-documents?docId=${docId}`, { method: 'DELETE' })
      setDocs((prev) => prev.filter((d) => d.id !== docId))
      setSelected((prev) => { const next = new Set(prev); next.delete(docId); return next })
    } finally {
      setDeletingId(null)
    }
  }

  const zipHref = `/api/company-documents/zip?ids=${[...selected].join(',')}`

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Documentos de la empresa
          {docs.length > 0 && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{docs.length}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <a
              href={zipHref}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Descargar ZIP ({selected.size})
            </a>
          ) : (
            <span className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-300">
              Descargar ZIP
            </span>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-ink hover:bg-brand-600"
          >
            {showForm ? 'Cancelar' : '+ Subir documento'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tipo *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CompanyDocTypeId)}
                className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              >
                {COMPANY_DOC_TYPE.map((t) => (
                  <option key={t} value={t}>{COMPANY_DOC_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nombre personalizado</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej. Reglamento interno 2026"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Archivo (PDF, JPG, PNG — máx. 10 MB) *</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                required
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-brand file:px-2 file:py-0.5 file:text-xs file:font-medium file:text-ink"
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
      {error && !showForm && <p className="mb-3 text-xs text-red-600">{error}</p>}

      {docs.length === 0 ? (
        <EmptyState title="Sin documentos" description="Sube el primero con el botón de arriba." />
      ) : (
        <ul className="divide-y divide-gray-100">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggleSelected(d.id)}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-brand"
                  aria-label={`Incluir ${d.label ?? d.type} en el ZIP`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {d.label || COMPANY_DOC_TYPE_LABELS[d.type as CompanyDocTypeId] || d.type}
                  </p>
                  <p className="text-xs text-gray-500">
                    {COMPANY_DOC_TYPE_LABELS[d.type as CompanyDocTypeId] ?? d.type} · {formatDate(d.uploadedAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <FilePreviewButton
                  fileUrl={d.fileUrl}
                  type="company"
                  name={d.label || COMPANY_DOC_TYPE_LABELS[d.type as CompanyDocTypeId] || d.type}
                  meta={[
                    { label: 'Categoría', value: COMPANY_DOC_TYPE_LABELS[d.type as CompanyDocTypeId] ?? d.type },
                    { label: 'Dueño', value: 'Empresa' },
                    { label: 'Subido', value: formatDate(d.uploadedAt) },
                  ]}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                />
                <button
                  onClick={() => handleDelete(d.id)}
                  disabled={deletingId === d.id}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingId === d.id && <Spinner size={12} />}
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
