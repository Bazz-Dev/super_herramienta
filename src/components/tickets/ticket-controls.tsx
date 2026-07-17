'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { updateTicketFields, updateTicketStatus, addTicketComment } from '@/app/(app)/tickets/actions'
import { ALL_STATUSES, STATUS_LABEL, type TicketStatusId } from '@/lib/tickets/labels'
import { PhotoGallery } from '@/components/tickets/photo-gallery'

type Item    = { id: string; title: string; status: string; description: string | null }
type Doc     = { id: string; name: string; fileUrl: string; mimeType: string | null; uploadedAt: Date }
type Informe = { id: string; title: string; createdAt: string }

interface Props {
  ticket: {
    id: string
    status: string
    otNumber: string | null
    assignedToId: string | null
    estimatedDate: string | null
    workSummary: string | null
    internalNotes: string | null
    folderKey: string | null
    showToClient: boolean
    items: Item[]
    documents: Doc[]
  }
  staffUsers: { id: string; name: string }[]
  technicians: { id: string; name: string }[]
  linkedInformes?: Informe[]
}

// ── doc helpers ────────────────────────────────────────────────────────────────

function isMedia(mime: string | null | undefined) {
  return !!mime && (mime.startsWith('image/') || mime.startsWith('video/'))
}
function isImage(mime: string | null | undefined) {
  return !!mime?.startsWith('image/')
}
function resolveUrl(fileUrl: string) {
  return (fileUrl.startsWith('/') || fileUrl.startsWith('http'))
    ? fileUrl
    : `/api/files?key=${encodeURIComponent(fileUrl)}&type=ticket`
}
function fileIcon(mimeType: string | null, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mimeType?.includes('pdf') || ext === 'pdf')                              return '📄'
  if (mimeType?.includes('word') || ['doc', 'docx'].includes(ext))            return '📝'
  if (mimeType?.includes('excel') || mimeType?.includes('sheet') || ['xls', 'xlsx'].includes(ext)) return '📊'
  if (mimeType?.includes('zip') || mimeType?.includes('compress') || ['zip', 'rar', '7z'].includes(ext)) return '🗜️'
  if (mimeType?.includes('text') || ext === 'txt')                            return '📃'
  return '📎'
}

export function TicketControls({ ticket, staffUsers, technicians, linkedInformes = [] }: Props) {
  // G24: transiciones separadas — un guardado en curso no bloquea las otras
  // acciones ni deja todo el panel en "Guardando…".
  const [fieldsPending, startFields] = useTransition()
  const [statusPending, startStatus] = useTransition()
  const [commentPending, startComment] = useTransition()
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [docs, setDocs] = useState<Doc[]>(ticket.documents)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [otNumber, setOtNumber] = useState(ticket.otNumber ?? '')
  const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? '')
  const [estimatedDate, setEstimatedDate] = useState(ticket.estimatedDate ?? '')
  const [workSummary, setWorkSummary] = useState(ticket.workSummary ?? '')
  const [showToClient, setShowToClient] = useState(ticket.showToClient)
  const [saved, setSaved] = useState(false)

  function handleSaveFields() {
    startFields(async () => {
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
    startStatus(async () => { await updateTicketStatus(ticket.id, newStatus) })
  }

  function handleComment() {
    if (!comment.trim()) return
    startComment(async () => {
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
            <label className="block text-xs text-gray-500 mb-1">
              Estado{statusPending && <span className="ml-1 text-amber-600">· guardando…</span>}
            </label>
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusPending}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50"
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
              disabled={fieldsPending}
              className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {fieldsPending ? 'Guardando…' : 'Guardar cambios'}
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

      {/* ── DOCUMENTOS ── 3 secciones separadas ──────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

        {/* ── 1. Multimedia (fotos y videos) ── */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M6 6.5l4 2.5-4 2.5V6.5z" fill="currentColor" stroke="none"/></svg>
            Fotos y videos
            {docs.filter(d => isMedia(d.mimeType)).length > 0 && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                {docs.filter(d => isMedia(d.mimeType)).length}
              </span>
            )}
          </h3>
          <PhotoGallery
            items={docs.filter(d => isMedia(d.mimeType)).map(doc => ({
              id: doc.id,
              name: doc.name,
              url: resolveUrl(doc.fileUrl),
              mimeType: doc.mimeType,
            }))}
            accent="#f5b100"
            onUpload={async (file) => {
              const fd = new FormData(); fd.append('file', file)
              const res = await fetch(`/api/tickets/${ticket.id}/documents`, { method: 'POST', body: fd })
              if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Error al subir') }
              const newDoc: Doc = await res.json()
              setDocs(prev => [...prev, newDoc])
              return { id: newDoc.id, name: newDoc.name, url: resolveUrl(newDoc.fileUrl), mimeType: newDoc.mimeType }
            }}
            onDelete={async (id) => {
              const res = await fetch(`/api/tickets/${ticket.id}/documents?docId=${id}`, { method: 'DELETE' })
              if (!res.ok) throw new Error('Error al eliminar')
              setDocs(prev => prev.filter(d => d.id !== id))
            }}
          />
        </div>

        {/* ── 2. Archivos adjuntos (docs/pdfs/etc.) ── */}
        <div className="p-4 border-b border-gray-100">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3"/></svg>
              Archivos adjuntos
              {docs.filter(d => !isMedia(d.mimeType)).length > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                  {docs.filter(d => !isMedia(d.mimeType)).length}
                </span>
              )}
            </h3>
            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 ${uploading ? 'opacity-40 pointer-events-none' : ''}`}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4.5 5.5 8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 12.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              {uploading ? 'Subiendo…' : 'Adjuntar'}
              <input type="file" className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return
                  setUploading(true); setUploadError('')
                  const fd = new FormData(); fd.append('file', file)
                  try {
                    const res = await fetch(`/api/tickets/${ticket.id}/documents`, { method: 'POST', body: fd })
                    if (!res.ok) { const j = await res.json(); setUploadError(j.error ?? 'Error al subir'); return }
                    const newDoc: Doc = await res.json()
                    setDocs(prev => [...prev, newDoc])
                  } catch { setUploadError('Error de red') }
                  finally { setUploading(false); e.target.value = '' }
                }}
              />
            </label>
          </div>

          {uploadError && <p className="mb-2 text-xs text-red-600">{uploadError}</p>}
          {docs.filter(d => !isMedia(d.mimeType)).length === 0 ? (
            <p className="text-xs text-gray-400">Sin archivos adjuntos.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {docs.filter(d => !isMedia(d.mimeType)).map(doc => (
                <li key={doc.id} className="flex items-center gap-2 py-2">
                  <span className="text-base shrink-0">{fileIcon(doc.mimeType, doc.name)}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate" title={doc.name}>{doc.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <a href={resolveUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand hover:underline font-medium">Abrir ↗</a>
                    <button type="button" className="text-xs text-red-400 hover:text-red-600 transition"
                      onClick={async () => {
                        if (!confirm(`Eliminar "${doc.name}"?`)) return
                        const res = await fetch(`/api/tickets/${ticket.id}/documents?docId=${doc.id}`, { method: 'DELETE' })
                        if (res.ok) setDocs(prev => prev.filter(d => d.id !== doc.id))
                      }}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── 3. Documentos de trabajo (generados) ── */}
        <div className="p-4 bg-gray-50/60">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1" width="12" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/><circle cx="12" cy="12" r="3.5" fill="#f5b100" stroke="none"/><path d="M12 10.5v3M10.5 12h3" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Documentos de trabajo
          </h3>

          {/* OT */}
          {ticket.otNumber && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">OT</span>
              <span className="font-mono text-sm font-bold text-ink">{ticket.otNumber}</span>
            </div>
          )}

          {/* Informes técnicos vinculados */}
          {linkedInformes.length > 0 && (
            <ul className="mb-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
              {linkedInformes.map(inf => (
                <li key={inf.id} className="flex items-center gap-2 px-3 py-2.5">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-indigo-500"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3M5 7h6M5 10h4"/></svg>
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{inf.title}</span>
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {new Date(inf.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <Link
                    href={`/informe?docId=${inf.id}`}
                    className="shrink-0 text-xs text-brand hover:underline font-medium"
                  >
                    Ver ↗
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Acción: nuevo informe */}
          <Link
            href={`/informe?ticketId=${ticket.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand hover:bg-brand/5"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4.5 5.5 8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 12.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            Nuevo informe técnico
          </Link>
        </div>
      </div>

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
            disabled={commentPending || !comment.trim()}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
          >
            {isInternal ? '🔒 Guardar nota' : 'Publicar comentario'}
          </button>
        </div>
      </div>
    </div>
  )
}
