'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateTicketFields, updateTicketStatus, addTicketComment, promoteDocumentToOT } from '@/app/(app)/tickets/actions'
import { SELECTABLE_STATUSES, STATUS_LABEL, type TicketStatusId } from '@/lib/tickets/labels'
import { PROCESS_FLOW_LABELS } from '@/lib/cashflow/labels'
import { PhotoGallery } from '@/components/tickets/photo-gallery'
import { uploadDirect } from '@/lib/upload-direct'
import { DocumentQuickPreview } from '@/components/quotes/document-quick-preview'
import { FilePreviewButton } from '@/components/ui/file-preview-modal'

type Item      = { id: string; title: string; status: string; description: string | null; category: string | null; comment: string | null }
type Doc       = { id: string; name: string; fileUrl: string; mimeType: string | null; uploadedAt: Date; itemId?: string | null }
type Informe   = { id: string; title: string; createdAt: string }
type Propuesta = { id: string; title: string; createdAt: string; quoteId?: string | null }

interface Props {
  ticket: {
    id: string
    ticketCode: string
    status: string
    otNumber: string | null
    otFileUrl: string | null
    assignedToId: string | null
    estimatedDate: string | null
    workSummary: string | null
    internalNotes: string | null
    folderKey: string | null
    showToClient: boolean
    processFlow: string | null
    items: Item[]
    documents: Doc[]
  }
  staffUsers: { id: string; name: string }[]
  technicians: { id: string; name: string }[]
  linkedInformes?: Informe[]
  linkedPropuestas?: Propuesta[]
  parentTicket?: { id: string; ticketCode: string } | null
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

export function TicketControls({ ticket, staffUsers, technicians, linkedInformes = [], linkedPropuestas = [], parentTicket = null }: Props) {
  const router = useRouter()
  // G24: transiciones separadas — un guardado en curso no bloquea las otras
  // acciones ni deja todo el panel en "Guardando…".
  const [fieldsPending, startFields] = useTransition()
  const [statusPending, startStatus] = useTransition()
  const [commentPending, startComment] = useTransition()
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [docs, setDocs] = useState<Doc[]>(ticket.documents)
  // Confirmación in-app para el borrado de "Otros" (nunca window.confirm,
  // regla de frontend.md sin excepciones) — un solo id a la vez, mismo
  // patrón que confirmingDelete en document-quick-preview.tsx.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [otFileUrl, setOtFileUrl] = useState(ticket.otFileUrl)
  const [otUploading, setOtUploading] = useState(false)
  const [otPromotingId, setOtPromotingId] = useState<string | null>(null)
  const [otError, setOtError] = useState('')
  const [otNumber, setOtNumber] = useState(ticket.otNumber ?? '')
  const [assignedToId, setAssignedToId] = useState(ticket.assignedToId ?? '')
  const [estimatedDate, setEstimatedDate] = useState(ticket.estimatedDate ?? '')
  const [workSummary, setWorkSummary] = useState(ticket.workSummary ?? '')
  const [showToClient, setShowToClient] = useState(ticket.showToClient)
  const [processFlow, setProcessFlow] = useState(ticket.processFlow ?? '')
  const [saved, setSaved] = useState(false)
  const [statusError, setStatusError] = useState('')

  // "Asignación y control" vive en estado local hasta apretar "Guardar
  // cambios" — si el usuario cambia el técnico y sale de la página por
  // cualquier otra vía (link del sidebar, "Volver a tickets", cerrar la
  // pestaña) sin guardar, el cambio se pierde en silencio y parece que la
  // asignación "no quedó". El snapshot se actualiza tras cada guardado
  // exitoso para que dirty vuelva a false sin necesitar un reload.
  const [lastSaved, setLastSaved] = useState({ otNumber: ticket.otNumber ?? '', assignedToId: ticket.assignedToId ?? '', estimatedDate: ticket.estimatedDate ?? '', workSummary: ticket.workSummary ?? '', showToClient: ticket.showToClient, processFlow: ticket.processFlow ?? '' })
  const dirty = otNumber !== lastSaved.otNumber
    || assignedToId !== lastSaved.assignedToId
    || estimatedDate !== lastSaved.estimatedDate
    || workSummary !== lastSaved.workSummary
    || showToClient !== lastSaved.showToClient
    || processFlow !== lastSaved.processFlow

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!dirty) return
    // Next.js App Router no tiene un hook de "confirmar antes de navegar" para
    // <Link>/router.push — se intercepta el click en captura, igual patrón
    // que usan otras apps sin acceso a un blocker nativo.
    function onClickCapture(e: MouseEvent) {
      const link = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || link.target === '_blank') return
      if (!confirm('Tenés cambios sin guardar en Asignación y control. ¿Salir igual y perderlos?')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('click', onClickCapture, true)
    return () => document.removeEventListener('click', onClickCapture, true)
  }, [dirty])

  function handleSaveFields() {
    startFields(async () => {
      await updateTicketFields(ticket.id, {
        otNumber: otNumber || undefined,
        assignedToId: assignedToId || null,
        estimatedDate: estimatedDate || undefined,
        workSummary: workSummary || undefined,
        showToClient,
        processFlow: (processFlow || null) as 'pre_quote' | 'post_execution' | null,
      })
      setLastSaved({ otNumber, assignedToId, estimatedDate, workSummary, showToClient, processFlow })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  // Subida/reemplazo de OT — mismo endpoint ya usado y probado en el panel
  // del técnico (tecnico-ticket-actions.tsx). Antes esta ficha no tenía
  // ningún control conectado a él (bug real, ver promoteDocumentToOT).
  async function uploadOT(file: File) {
    setOtUploading(true)
    setOtError('')
    try {
      const { key, contentType } = await uploadDirect(`/api/tickets/${ticket.id}/ot-photo/upload-url`, file)
      const res = await fetch(`/api/tickets/${ticket.id}/ot-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, mimeType: contentType }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setOtError(body.error ?? `Error ${res.status} al subir la OT.`)
      } else {
        const body = await res.json()
        setOtFileUrl(body.otFileUrl)
        // TicketDocumentsPanel (más abajo en la misma página) lee su propio
        // `documents`/otFileUrl como prop de server component, independiente
        // del estado local de acá -- sin refrescar, seguía mostrando el
        // estado viejo de la OT hasta un reload manual completo.
        router.refresh()
      }
    } catch (e) {
      setOtError(e instanceof Error ? e.message : 'Error al subir la OT.')
    } finally {
      setOtUploading(false)
    }
  }

  // Promueve un archivo ya subido como "Otro" a ser la OT, sin re-subirlo —
  // resuelve documentos ya mal clasificados antes de que existiera el botón
  // de arriba, sin pedirle a nadie que vuelva a buscar el PDF/foto original.
  function promoteToOT(docId: string) {
    setOtPromotingId(docId)
    setOtError('')
    startFields(async () => {
      const res = await promoteDocumentToOT(ticket.id, docId)
      if (res.success) {
        setDocs(prev => prev.filter(d => d.id !== docId))
        const doc = docs.find(d => d.id === docId)
        if (doc) setOtFileUrl(doc.fileUrl)
        router.refresh() // ver comentario en uploadOT — mismo problema de sincronía con TicketDocumentsPanel
      } else {
        setOtError(res.error ?? 'No se pudo promover a OT.')
      }
      setOtPromotingId(null)
    })
  }

  // El N° OT (y demás campos de "Asignación y control") vive en estado local
  // hasta que se aprieta "Guardar cambios" — navegar directo a /informe sin
  // guardar primero dejaba el informe leyendo el otNumber viejo desde la DB.
  function goToNewInforme() {
    startFields(async () => {
      await updateTicketFields(ticket.id, {
        otNumber: otNumber || undefined,
        assignedToId: assignedToId || null,
        estimatedDate: estimatedDate || undefined,
        workSummary: workSummary || undefined,
        showToClient,
        processFlow: (processFlow || null) as 'pre_quote' | 'post_execution' | null,
      })
      setLastSaved({ otNumber, assignedToId, estimatedDate, workSummary, showToClient, processFlow })
      router.push(`/informe?ticketId=${ticket.id}`)
    })
  }

  function handleStatusChange(newStatus: string) {
    setStatusError('')
    startStatus(async () => {
      const res = await updateTicketStatus(ticket.id, newStatus)
      if (!res.success) setStatusError(res.error ?? 'No se pudo actualizar el estado.')
    })
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
            {ticket.status === 'fusionado' ? (
              <div className="flex h-[34px] items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">
                Fusionado{parentTicket ? ` en ${parentTicket.ticketCode}` : ''} — gestionado desde el portal del cliente
              </div>
            ) : (
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusPending}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50"
              >
                {SELECTABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s as TicketStatusId]}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Modalidad comercial</label>
            <select
              value={processFlow}
              onChange={(e) => setProcessFlow(e.target.value)}
              disabled={isClosed}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-50"
            >
              <option value="">Sin definir</option>
              {(['pre_quote', 'post_execution'] as const).map((pf) => (
                <option key={pf} value={pf}>{PROCESS_FLOW_LABELS[pf]}</option>
              ))}
            </select>
          </div>
        </div>

        {statusError && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{statusError}</p>
        )}

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
          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showToClient}
              onChange={(e) => setShowToClient(e.target.checked)}
              className="rounded"
            />
            Visible para el cliente en el portal
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

      {/* Items — "requerimientos" cuando el ticket se creó vía el flujo
          multi-requerimiento del portal (FASE 2), o sub-tareas agregadas
          después por el cliente. Mismo modelo, category/comment quedan null
          en el segundo caso. */}
      {ticket.items.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Requerimientos
            <span className="ml-2 text-xs text-gray-400">
              {ticket.items.filter(i => i.status === 'resuelto').length}/{ticket.items.length} resueltos
            </span>
          </h3>
          <ul className="space-y-3">
            {ticket.items.map((item) => {
              const fileCount = ticket.documents.filter(d => d.itemId === item.id).length
              return (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${item.status === 'resuelto' ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'} flex items-center justify-center text-[10px]`}>
                    {item.status === 'resuelto' && '✓'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={item.status === 'resuelto' ? 'line-through text-gray-400' : 'text-gray-700'}>
                      {item.category && <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{item.category}</span>}
                      {item.title}
                    </span>
                    {item.description && <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>}
                    {item.comment && <p className="mt-0.5 text-xs italic text-gray-400">&quot;{item.comment}&quot;</p>}
                    {fileCount > 0 && <p className="mt-0.5 text-xs text-gray-400">📎 {fileCount} archivo{fileCount !== 1 ? 's' : ''}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── DOCUMENTOS ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

        {/* ── 1. Adjuntos — fotos/videos como galería, el resto como lista;
               una sola sección y un solo botón de subida (acepta cualquier
               tipo permitido, selección múltiple) en vez de dos mecanismos
               separados que obligaban a adivinar cuál usar. ── */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3"/></svg>
            Adjuntos
            {docs.length > 0 && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                {docs.length}
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
            uploadLabel="Agregar archivo"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            onUpload={async (file) => {
              // Sube directo a R2 (uploadDirect) — el archivo ya no pasa por esta
              // función serverless, así que el 413 de plataforma que se veía acá
              // en vivo (archivo > límite de payload de Vercel) queda resuelto de
              // raíz, no solo mejor explicado.
              const { key, contentType } = await uploadDirect(`/api/tickets/${ticket.id}/documents/upload-url`, file)
              const res = await fetch(`/api/tickets/${ticket.id}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, name: file.name, mimeType: contentType }),
              })
              if (!res.ok) { const j = await res.json().catch(() => ({}) as { error?: string }); throw new Error(j.error ?? `Error al subir (${res.status})`) }
              const newDoc: Doc = await res.json()
              setDocs(prev => [...prev, newDoc])
              router.refresh() // ver comentario en uploadOT — mismo problema de sincronía con TicketDocumentsPanel
              return { id: newDoc.id, name: newDoc.name, url: resolveUrl(newDoc.fileUrl), mimeType: newDoc.mimeType }
            }}
            onDelete={async (id) => {
              const res = await fetch(`/api/tickets/${ticket.id}/documents?docId=${id}`, { method: 'DELETE' })
              if (!res.ok) throw new Error('Error al eliminar')
              setDocs(prev => prev.filter(d => d.id !== id))
              router.refresh() // ver comentario en uploadOT — mismo problema de sincronía con TicketDocumentsPanel
            }}
          />

          {docs.filter(d => !isMedia(d.mimeType)).length > 0 && (
            <ul className="mt-3 divide-y divide-gray-50 border-t border-gray-100">
              {docs.filter(d => !isMedia(d.mimeType)).map(doc => (
                <li key={doc.id} className="flex items-center gap-2 py-2">
                  <span className="text-base shrink-0">{fileIcon(doc.mimeType, doc.name)}</span>
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate" title={doc.name}>{doc.name}</span>
                  {confirmDeleteId === doc.id ? (
                    <div className="flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1">
                      <span className="text-xs font-medium text-red-700">¿Eliminar?</span>
                      <button type="button" className="text-xs font-medium text-gray-500 hover:text-ink"
                        onClick={() => setConfirmDeleteId(null)}>No</button>
                      <button type="button" className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-40"
                        disabled={deletingDocId === doc.id}
                        onClick={async () => {
                          setDeletingDocId(doc.id)
                          try {
                            const res = await fetch(`/api/tickets/${ticket.id}/documents?docId=${doc.id}`, { method: 'DELETE' })
                            if (res.ok) {
                              setDocs(prev => prev.filter(d => d.id !== doc.id))
                              router.refresh() // ver comentario en uploadOT — mismo problema de sincronía con TicketDocumentsPanel
                            }
                          } finally {
                            setDeletingDocId(null)
                            setConfirmDeleteId(null)
                          }
                        }}>
                        {deletingDocId === doc.id ? 'Eliminando…' : 'Sí, eliminar'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 shrink-0">
                      {!otFileUrl && (
                        <button type="button" className="text-xs text-gray-500 hover:text-ink hover:underline transition disabled:opacity-40"
                          disabled={otPromotingId === doc.id}
                          title="Este archivo pasa a ser la OT del ticket — no se vuelve a subir, solo se reclasifica."
                          onClick={() => promoteToOT(doc.id)}>
                          {otPromotingId === doc.id ? 'Marcando…' : 'Marcar como OT'}
                        </button>
                      )}
                      <a href={resolveUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-brand hover:underline font-medium">Abrir ↗</a>
                      <button type="button" className="text-xs text-red-400 hover:text-red-600 transition"
                        onClick={() => setConfirmDeleteId(doc.id)}>✕</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── 2. Documentos de trabajo (generados) ── */}
        <div className="p-4 bg-gray-50/60">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="1" width="12" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/><circle cx="12" cy="12" r="3.5" fill="var(--color-brand)" stroke="none"/><path d="M12 10.5v3M10.5 12h3" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Documentos de trabajo
          </h3>

          {/* PT / OT / IT — 3 casilleros fijos, mismo patrón visual que
              Contrato/Carnet en la ficha de técnico (doc-section.tsx).
              PT (propuesta) se genera antes o junto con el ticket, vía
              Cotizador; OT la sube el técnico (acá se preserva ese flujo,
              antes sin botón conectado — bug real, ver promoteDocumentToOT);
              IT (informe) lo genera y envía la administración. Esta ficha es
              staff-only (el técnico nunca llega a /tickets/[id] — ver
              data.md), así que no hace falta ocultar PT/IT por rol acá. */}
          <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <DocSlot title="PT · Propuesta" filled={linkedPropuestas.length > 0}>
              {linkedPropuestas.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {linkedPropuestas.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-1.5 text-[11px]">
                      <span className="truncate text-gray-600">{p.title}</span>
                      <DocumentQuickPreview
                        docId={p.id} title={p.title} documentType="propuesta" editHref={`/cotizador?docId=${p.id}`}
                        trigger="Ver" triggerClassName="shrink-0 font-semibold text-brand hover:underline"
                        ticketCode={ticket.ticketCode} number={p.quoteId}
                      />
                    </div>
                  ))}
                  {linkedPropuestas.length > 3 && <span className="text-[10px] text-gray-400">+{linkedPropuestas.length - 3} más</span>}
                </div>
              ) : (
                <Link href={`/cotizador?new=1&ticketId=${ticket.id}`} className="text-[11px] font-medium text-gray-500 hover:text-brand hover:underline">
                  Falta — crear propuesta
                </Link>
              )}
            </DocSlot>

            <DocSlot title="OT · Orden de trabajo" filled={!!otFileUrl}>
              {otFileUrl ? (
                <div className="flex items-center gap-2 text-[11px]">
                  {/* Antes <a target=_blank> a la key cruda — bug real: navegaba
                      afuera de la app en vez de abrir el mismo preview in-app
                      que ya usa cualquier otro archivo (FilePreviewButton), y
                      no se beneficiaba del fix de descarga de G60. */}
                  <FilePreviewButton
                    fileUrl={otFileUrl} type="ticket" name={ticket.otNumber ? `OT ${ticket.otNumber}` : 'Orden de trabajo'}
                    label="Ver" className="font-semibold text-brand hover:underline"
                  />
                  <label className={`cursor-pointer font-medium text-gray-500 hover:text-ink hover:underline ${otUploading ? 'pointer-events-none opacity-40' : ''}`}>
                    {otUploading ? 'Subiendo…' : 'Reemplazar'}
                    <input type="file" accept="application/pdf,image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadOT(f); e.target.value = '' }} />
                  </label>
                </div>
              ) : (
                <label className={`cursor-pointer text-[11px] font-medium text-gray-500 hover:text-brand hover:underline ${otUploading ? 'pointer-events-none opacity-40' : ''}`}>
                  {otUploading ? 'Subiendo…' : 'Falta — escanear / adjuntar'}
                  <input type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadOT(f); e.target.value = '' }} />
                </label>
              )}
            </DocSlot>

            <DocSlot title="IT · Informe técnico" filled={linkedInformes.length > 0}>
              {linkedInformes.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {linkedInformes.slice(0, 3).map(inf => (
                    <div key={inf.id} className="flex items-center justify-between gap-1.5 text-[11px]">
                      <span className="truncate text-gray-600">{inf.title}</span>
                      <DocumentQuickPreview
                        docId={inf.id} title={inf.title} documentType="informe" editHref={`/informe?docId=${inf.id}`}
                        trigger="Ver" triggerClassName="shrink-0 font-semibold text-brand hover:underline"
                        ticketCode={ticket.ticketCode}
                      />
                    </div>
                  ))}
                  {linkedInformes.length > 3 && <span className="text-[10px] text-gray-400">+{linkedInformes.length - 3} más</span>}
                </div>
              ) : (
                // Guarda los cambios pendientes (N° OT, etc.) antes de navegar,
                // para que /informe autocomplete con datos frescos.
                <button type="button" onClick={goToNewInforme} disabled={fieldsPending}
                  className="text-left text-[11px] font-medium text-gray-500 hover:text-brand hover:underline disabled:opacity-50">
                  {fieldsPending ? 'Guardando…' : 'Falta — crear informe'}
                </button>
              )}
            </DocSlot>
          </div>
          {otError && <p className="mb-3 text-xs text-red-600">{otError}</p>}
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

// Shell visual compartido por los 3 casilleros PT/OT/IT — mismo lenguaje que
// FixedSlot en doc-section.tsx (border-ok-200/bg-ok-50 lleno, dashed vacío),
// el contenido interno (upload de archivo vs. lista de documentos generados)
// difiere por casillero así que solo se comparte el marco.
function DocSlot({ title, filled, children }: { title: string; filled: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex min-h-16 flex-col justify-center gap-1.5 rounded-lg border p-3 ${filled ? 'border-ok-200 bg-ok-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
      <span className={`text-xs font-semibold uppercase tracking-wide ${filled ? 'text-ok-700' : 'text-gray-500'}`}>{filled && '✓ '}{title}</span>
      {children}
    </div>
  )
}
