'use client'

import { useState } from 'react'
import { COMPANY_DOC_TYPE, COMPANY_DOC_TYPE_LABELS, type CompanyDocTypeId } from '@/lib/resources/labels'

type Doc = {
  id: string
  type: string
  label: string | null
  fileUrl: string
  uploadedAt: Date
}

function fileHref(fileUrl: string) {
  if (fileUrl.startsWith('/') || fileUrl.startsWith('http')) return fileUrl
  return `/api/files?key=${encodeURIComponent(fileUrl)}&type=company`
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function CompanyDocSection({ initial }: { initial: Doc[] }) {
  const [docs, setDocs] = useState<Doc[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<CompanyDocTypeId>('reglamento')
  const [label, setLabel] = useState('')
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

    setUploading(true)
    try {
      const res = await fetch('/api/company-documents', { method: 'POST', body: fd })
      const json = await res.json() as { doc?: Doc; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Error al subir')
      setDocs((prev) => [json.doc!, ...prev])
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
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Documentos de la empresa
          {docs.length > 0 && (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{docs.length}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <a
            href="/api/company-documents/zip"
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Descargar ZIP
          </a>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-ink hover:bg-brand-600"
          >
            {showForm ? 'Cancelar' : '+ Subir documento'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="mb-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
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

      {docs.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-400">Sin documentos. Sube el primero con el botón de arriba.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {d.label || COMPANY_DOC_TYPE_LABELS[d.type as CompanyDocTypeId] || d.type}
                </p>
                <p className="text-xs text-gray-500">
                  {COMPANY_DOC_TYPE_LABELS[d.type as CompanyDocTypeId] ?? d.type} · {formatDate(d.uploadedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={fileHref(d.fileUrl)} target="_blank" rel="noopener noreferrer" className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">Ver</a>
                <button
                  onClick={() => handleDelete(d.id)}
                  disabled={deletingId === d.id}
                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-60"
                >
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
