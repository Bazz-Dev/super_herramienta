'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { renderQuoteHTML } from '@/lib/quotes/template'
import { renderReportHTML } from '@/lib/reports/template'
import { previewSrc } from '@/lib/reports/resolve-preview-url'
import type { ReportData } from '@/lib/reports/types'
import { buildDownloadFilename } from '@/lib/tickets/file-naming'
import { ActivityOverlay } from '@/components/ui/activity-indicator'

// Shell visual compartido del modal de preview — antes documents-view.tsx
// tenía su propio overlay full-screen paralelo a este (mismo fixed inset-0 +
// header + botón cerrar) pero SIN los botones de acción (Descargar/Ver en
// grande/Editar), lo que hacía que abrir una propuesta ahí se sintiera como
// un callejón sin salida en vez del mismo patrón "Ver" que ya tiene esta
// vista de Propuestas/Informes. Extraído para que ambos monten literalmente
// el mismo marco — cada caller decide sus propios botones/contenido (mismo
// criterio que PortalDocumentPreview/PortalDocumentPreviewModal, que ya
// separaban trigger de modal por la misma razón).
export function DocumentPreviewShell({
  title, onClose, actions, children,
}: {
  title: string
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={onClose}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <span className="max-w-[50vw] truncate text-sm font-semibold text-gray-800">{title}</span>
        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onClose}
            className="ml-1 flex min-h-9 min-w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Cerrar vista previa"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// Vista previa rápida desde el listado de Propuestas/Informes (pedido
// explícito del dueño: clic en el nombre = preview in-place, no navegar al
// editor de una) — mismo mecanismo que documents-view.tsx ya usa (fetch
// dataJson → renderQuoteHTML/renderReportHTML → iframe), reempaquetado acá
// como un componente compartido porque ambos listados lo necesitan igual.
export function DocumentQuickPreview({
  docId, title, documentType, editHref, trigger, triggerClassName, ticketCode, number, onDelete,
}: {
  docId: string
  title: string
  documentType: 'propuesta' | 'informe'
  editHref: string
  /** Trigger alternativo (p.ej. un ícono/badge) — por defecto es el título como link de texto. */
  trigger?: ReactNode
  triggerClassName?: string
  /** Ticket.ticketCode del ticket vinculado, si hay — para el nombre de archivo (ver file-naming.ts). */
  ticketCode?: string | null
  /** ClientDocument.quoteId — solo aplica a propuestas, informes no llevan número. */
  number?: string | null
  /** Cuando se pasa, agrega un botón "Eliminar" en el modal — confirma primero, nunca window.confirm (ver frontend.md), luego llama esto. El caller decide el endpoint real (propuesta vs informe puede diferir a futuro). */
  onDelete?: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function fetchData(): Promise<unknown> {
    const res = await fetch(`/api/client-documents?id=${docId}`)
    if (!res.ok) throw new Error(`Error ${res.status} al cargar el documento`)
    const response = await res.json()
    const rawJson: string | null = response.dataJson ?? response.doc?.dataJson ?? null
    if (!rawJson) throw new Error('Este documento no tiene datos guardados')
    return JSON.parse(rawJson)
  }

  // Fotos/OT de un informe se guardan como key de R2, no data: URI — hay que
  // resolverlas a /api/files?... para el <img> del preview, igual que ya hace
  // report-editor.tsx (toPreviewData) para su propia vista previa en vivo.
  function toPreviewData(d: ReportData): ReportData {
    return { ...d, otImageUrl: previewSrc(d.otImageUrl), photos: d.photos.map((p) => ({ ...p, url: previewSrc(p.url) })) }
  }

  async function openPreview() {
    setOpen(true)
    if (html) return
    setLoading(true)
    setError('')
    try {
      const json = await fetchData()
      setHtml(
        documentType === 'propuesta'
          ? renderQuoteHTML(json as never)
          : renderReportHTML(toPreviewData(json as ReportData)),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar la vista previa')
    } finally {
      setLoading(false)
    }
  }

  function openLarge() {
    if (!html) return
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function download() {
    setDownloading(true)
    setError('')
    try {
      const json = await fetchData()
      const apiPath = documentType === 'propuesta' ? '/api/quotes/generate' : '/api/reports/generate'
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? err.error ?? `Error ${res.status} generando PDF`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = buildDownloadFilename({
        kind: documentType === 'propuesta' ? 'presupuesto' : 'informe_tecnico',
        number: documentType === 'propuesta' ? number : undefined,
        ticketCode,
      })
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descargar el PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={openPreview} className={triggerClassName ?? 'text-left font-medium text-brand hover:underline'}>
        {trigger ?? title}
      </button>

      {open && (
        <DocumentPreviewShell
          title={title}
          onClose={() => setOpen(false)}
          actions={
            <>
              <button type="button" onClick={download} disabled={downloading} className={buttonClass('secondary', 'sm')}>
                {downloading ? <Spinner size={12} /> : 'Descargar'}
              </button>
              <button type="button" onClick={openLarge} disabled={!html} className={buttonClass('secondary', 'sm')}>
                Ver en grande ↗
              </button>
              <Link href={editHref} className={buttonClass('primary', 'sm')}>Editar →</Link>
              {onDelete && !confirmingDelete && (
                <button type="button" onClick={() => setConfirmingDelete(true)} className={buttonClass('danger', 'sm')}>
                  Eliminar
                </button>
              )}
              {onDelete && confirmingDelete && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
                    <span className="text-xs font-medium text-red-700">¿Eliminar? No se reutilizará su número.</span>
                    <button type="button" onClick={() => { setConfirmingDelete(false); setDeleteError('') }} className={buttonClass('ghost', 'sm')}>No</button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={async () => {
                        setDeleting(true)
                        setDeleteError('')
                        try {
                          await onDelete()
                          setOpen(false)
                          setConfirmingDelete(false)
                        } catch (e) {
                          // Deja el modal abierto y el confirm visible para reintentar — un
                          // fetch fallido (401 sesión expirada, 404 ya eliminado por otro)
                          // nunca debe dejar el botón atascado en spinner sin explicación.
                          setDeleteError(e instanceof Error ? e.message : 'Error al eliminar')
                        } finally {
                          setDeleting(false)
                        }
                      }}
                      className={buttonClass('danger', 'sm')}
                    >
                      {deleting ? <Spinner size={12} /> : 'Sí, eliminar'}
                    </button>
                  </div>
                  {deleteError && <span className="text-xs font-medium text-red-600">{deleteError}</span>}
                </div>
              )}
            </>
          }
        >
          {loading && (
            <ActivityOverlay message="Preparando vista previa…" />
          )}
          {error && !loading && (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-600">{error}</div>
          )}
          {html && !loading && !error && (
            <iframe srcDoc={html} className="h-full w-full border-0 bg-white" title={title} sandbox="allow-same-origin" />
          )}
        </DocumentPreviewShell>
      )}
    </>
  )
}
