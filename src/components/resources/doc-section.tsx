'use client'

import { useState, useTransition } from 'react'
import { DOC_TYPE_LABELS, type DocTypeId } from '@/lib/resources/labels'
import { deleteDocument } from '@/app/(app)/recursos/tecnicos/actions'
import { Spinner } from '@/components/ui/spinner'

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
  ok: 'bg-ok-100 text-ok-700',
  warn: 'bg-warn-100 text-warn-700',
  expired: 'bg-danger-100 text-danger-700',
}

/** Build the URL to view/download a document through the signed-URL proxy. */
function fileHref(fileUrl: string) {
  if (fileUrl.startsWith('/') || fileUrl.startsWith('http')) return fileUrl
  return `/api/files?key=${encodeURIComponent(fileUrl)}&type=technician`
}

function formatDate(d: Date | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DocSection({ technicianId, initial }: { technicianId: string; initial: Doc[] }) {
  const [docs, setDocs] = useState<Doc[]>(initial)
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.map((d) => d.id)))
  const [uploading, setUploading] = useState<string | null>(null) // slot key while uploading, e.g. 'contrato' | 'carnet-Frontal' | 'extra'
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showExtraForm, setShowExtraForm] = useState(false)
  const [extraName, setExtraName] = useState('')
  const [extraExpiry, setExtraExpiry] = useState('')

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addDoc(doc: Doc) {
    setDocs((prev) => [doc, ...prev])
    setSelected((prev) => new Set(prev).add(doc.id))
  }

  async function uploadSlot(slotKey: string, type: DocTypeId, label: string | null, file: File, expiryDate?: string) {
    setError(null)
    setUploading(slotKey)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      fd.append('label', label ?? '')
      fd.append('expiryDate', expiryDate ?? '')
      fd.append('notes', '')
      const res = await fetch(`/api/technicians/${technicianId}/documents`, { method: 'POST', body: fd })
      const json = await res.json() as { doc?: Doc; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Error al subir')
      addDoc(json.doc!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(null)
    }
  }

  async function handleExtraSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const file = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0]
    if (!extraName.trim()) { setError('Ponle un nombre al documento.'); return }
    if (!file) { setError('Selecciona un archivo.'); return }
    await uploadSlot('extra', 'otro', extraName.trim(), file, extraExpiry)
    form.reset()
    setExtraName('')
    setExtraExpiry('')
    setShowExtraForm(false)
  }

  function handleDelete(docId: string) {
    if (!confirm('¿Eliminar este documento?')) return
    startTransition(async () => {
      await deleteDocument(docId, technicianId)
      setDocs((prev) => prev.filter((d) => d.id !== docId))
      setSelected((prev) => { const next = new Set(prev); next.delete(docId); return next })
    })
  }

  const contrato = docs.find((d) => d.type === 'contrato') ?? null
  const carnetFrontal = docs.find((d) => d.type === 'carnet' && d.label?.toLowerCase().includes('frontal')) ?? null
  const carnetReverso = docs.find((d) => d.type === 'carnet' && d.label?.toLowerCase().includes('reverso')) ?? null
  const extras = docs.filter((d) => d.type !== 'contrato' && !(d.type === 'carnet' && (d === carnetFrontal || d === carnetReverso)))
  const allFixedOk = !!contrato && !!carnetFrontal && !!carnetReverso

  const zipHref = `/api/technicians/${technicianId}/documents/zip?ids=${[...selected].join(',')}`

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          Documentos
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
            onClick={() => setShowExtraForm((v) => !v)}
            className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-ink hover:bg-brand-600"
          >
            {showExtraForm ? 'Cancelar' : '+ Agregar documento'}
          </button>
        </div>
      </div>

      {/* Estado general — base para acreditar al técnico ante plataformas de
          proveedores/clientes (permisos de ingreso a faenas). */}
      <p className={`mb-4 text-xs font-semibold ${allFixedOk ? 'text-ok-700' : 'text-warn-700'}`}>
        {allFixedOk ? '✓ Contrato y carnet completos' : 'Falta contrato y/o carnet — ver abajo'}
      </p>

      {/* Slots fijos: Contrato + Carnet (Frontal/Reverso) */}
      <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <FixedSlot
          title="Contrato"
          doc={contrato}
          selected={contrato ? selected.has(contrato.id) : false}
          onToggle={contrato ? () => toggleSelected(contrato.id) : undefined}
          onDelete={contrato ? () => handleDelete(contrato.id) : undefined}
          uploading={uploading === 'contrato'}
          onUpload={(file) => uploadSlot('contrato', 'contrato', null, file)}
          deleting={isPending}
        />
        <FixedSlot
          title="Carnet · Frontal"
          doc={carnetFrontal}
          selected={carnetFrontal ? selected.has(carnetFrontal.id) : false}
          onToggle={carnetFrontal ? () => toggleSelected(carnetFrontal.id) : undefined}
          onDelete={carnetFrontal ? () => handleDelete(carnetFrontal.id) : undefined}
          uploading={uploading === 'carnet-Frontal'}
          onUpload={(file) => uploadSlot('carnet-Frontal', 'carnet', 'Frontal', file)}
          deleting={isPending}
        />
        <FixedSlot
          title="Carnet · Reverso"
          doc={carnetReverso}
          selected={carnetReverso ? selected.has(carnetReverso.id) : false}
          onToggle={carnetReverso ? () => toggleSelected(carnetReverso.id) : undefined}
          onDelete={carnetReverso ? () => handleDelete(carnetReverso.id) : undefined}
          uploading={uploading === 'carnet-Reverso'}
          onUpload={(file) => uploadSlot('carnet-Reverso', 'carnet', 'Reverso', file)}
          deleting={isPending}
        />
      </div>

      {/* "+" Agregar documento libre — nombre + archivo, sin categorías que decidir */}
      {showExtraForm && (
        <form onSubmit={handleExtraSubmit} className="mb-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Nombre *</label>
              <input
                type="text"
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                placeholder="Ej. Reglamento interno, Anexo de contrato…"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Vencimiento (opcional)</label>
              <input
                type="date"
                value={extraExpiry}
                onChange={(e) => setExtraExpiry(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none"
              />
            </div>
            <div className="sm:col-span-3">
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
            disabled={uploading === 'extra'}
            className="mt-3 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {uploading === 'extra' ? 'Subiendo…' : 'Guardar documento'}
          </button>
        </form>
      )}
      {error && !showExtraForm && <p className="mb-3 text-xs text-red-600">{error}</p>}

      {/* Otros documentos */}
      {extras.length > 0 && (
        <>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Otros documentos</p>
          <ul className="divide-y divide-gray-100">
            {extras.map((d) => {
              const status = expiryStatus(d.expiryDate ? new Date(d.expiryDate) : null)
              return (
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
                        {d.label || DOC_TYPE_LABELS[d.type as DocTypeId] || d.type}
                      </p>
                      {d.expiryDate && (
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${EXPIRY_BADGE[status!]}`}>
                          {status === 'expired' ? 'Vencido' : status === 'warn' ? 'Por vencer' : 'Vigente'} · {formatDate(d.expiryDate ? new Date(d.expiryDate) : null)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <a href={fileHref(d.fileUrl)} target="_blank" rel="noopener noreferrer" className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50">Ver</a>
                    <button
                      onClick={() => handleDelete(d.id)}
                      disabled={isPending}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-60"
                    >
                      {isPending && <Spinner size={12} />}
                      Eliminar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function FixedSlot({
  title, doc, selected, onToggle, onDelete, uploading, onUpload, deleting,
}: {
  title: string
  doc: Doc | null
  selected: boolean
  onToggle?: () => void
  onDelete?: () => void
  uploading: boolean
  onUpload: (file: File) => void
  deleting: boolean
}) {
  if (!doc) {
    return (
      <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-center transition hover:border-brand hover:bg-brand/5">
        <span className="text-xs font-medium text-gray-500">{title}</span>
        <span className="text-[11px] text-gray-400">{uploading ? 'Subiendo…' : 'Falta — subir'}</span>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }}
        />
      </label>
    )
  }
  return (
    <div className="flex min-h-24 flex-col justify-between gap-2 rounded-lg border border-ok-200 bg-ok-50 p-3">
      <div className="flex items-start gap-1.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand"
          aria-label={`Incluir ${title} en el ZIP`}
        />
        <span className="text-xs font-semibold text-ok-700">✓ {title}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <a href={fileHref(doc.fileUrl)} target="_blank" rel="noopener noreferrer" className="rounded border border-ok-300 bg-white px-1.5 py-0.5 text-ok-700 hover:bg-ok-100">Ver</a>
        <button onClick={onDelete} disabled={deleting} className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-red-600 hover:bg-red-50 disabled:opacity-60">Eliminar</button>
      </div>
    </div>
  )
}
