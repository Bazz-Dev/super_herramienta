'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ownedDocState, linkedDocState, DOC_STATE_DOT, DOC_STATE_LABELS, type DocState } from '@/lib/cashflow/job-presets'
import { PURCHASE_ORDER_STATUS_LABELS, PURCHASE_ORDER_STATUS_COLORS } from '@/lib/cashflow/labels'

// Grilla de documentos de un trabajo (OC/Factura/OT/Informe) — compartida
// entre la edición rápida del acordeón (/flujo) y la ficha completa
// (/flujo/trabajos/[id]), para no mantener dos copias de la misma lógica de
// adjuntar/reemplazar/desvincular. OC/Factura son scalars propios de Job
// (mismo patrón que Ticket.otFileUrl); OT/Informe se gestionan en el ticket
// de origen — acá solo se enlaza, nunca se duplica el archivo.
export function JobDocumentsGrid({
  jobId, purchaseOrder, purchaseOrderFileUrl, purchaseOrderStatus, invoiceNumber, invoiceFileUrl, invoiceStatus, otFileUrl, originTicketId, informeDocId,
}: {
  jobId: string
  purchaseOrder: string | null
  purchaseOrderFileUrl: string | null
  purchaseOrderStatus?: string | null
  invoiceNumber: string | null
  invoiceFileUrl: string | null
  invoiceStatus?: string | null
  otFileUrl: string | null
  originTicketId: string | null
  informeDocId: string | null
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <OwnedDocSlot jobId={jobId} label="OC" docField="purchaseOrder" numberValue={purchaseOrder} fileUrl={purchaseOrderFileUrl} statusValue={purchaseOrderStatus} />
      <OwnedDocSlot jobId={jobId} label="Factura" docField="invoice" numberValue={invoiceNumber} fileUrl={invoiceFileUrl} statusValue={invoiceStatus} />
      <LinkedDocSlot
        label="OT"
        moduleName="Tickets"
        state={linkedDocState(otFileUrl)}
        viewHref={otFileUrl && originTicketId ? `/api/tickets/${originTicketId}/ot-photo` : undefined}
        manageHref={originTicketId ? `/tickets/${originTicketId}` : `/tickets/new?jobId=${jobId}`}
        manageLabel={originTicketId ? 'Ver ticket →' : 'Crear ticket →'}
      />
      <LinkedDocSlot
        label="Informe"
        moduleName="Informe Técnico"
        state={linkedDocState(informeDocId)}
        viewHref={informeDocId ? `/informe?docId=${informeDocId}` : undefined}
        manageHref={!informeDocId && originTicketId ? `/informe?ticketId=${originTicketId}` : undefined}
        manageLabel="Crear informe →"
      />
    </div>
  )
}

export function DocBadge({ state }: { state: DocState }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500">
      <span className={`h-1.5 w-1.5 rounded-full ${DOC_STATE_DOT[state]}`} />
      {DOC_STATE_LABELS[state]}
    </span>
  )
}

// OC/Factura: el archivo es un scalar propio de Job — adjuntar/reemplazar/
// desvincular pegan directo a /api/flujo/trabajos/[id]/documents,
// independiente de cualquier submit de los demás campos del trabajo.
function OwnedDocSlot({
  jobId, label, docField, numberValue, fileUrl, statusValue,
}: {
  jobId: string
  label: string
  docField: 'purchaseOrder' | 'invoice'
  numberValue: string | null
  fileUrl: string | null
  statusValue?: string | null
}) {
  const [currentUrl, setCurrentUrl] = useState(fileUrl)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const state = ownedDocState(numberValue, currentUrl)

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('docField', docField)
    const res = await fetch(`/api/flujo/trabajos/${jobId}/documents`, { method: 'POST', body: fd })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'No se pudo subir el archivo.')
      return
    }
    const body = (await res.json()) as { fileUrl: string }
    setCurrentUrl(body.fileUrl)
  }

  async function onUnlink() {
    if (!confirm(`¿Quitar el archivo adjunto de ${label}? El número registrado se mantiene.`)) return
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/flujo/trabajos/${jobId}/documents`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docField }),
    })
    setBusy(false)
    if (!res.ok) {
      setError('No se pudo quitar el archivo.')
      return
    }
    setCurrentUrl(null)
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        <DocBadge state={state} />
      </div>
      <p className="mb-1.5 truncate text-xs text-ink">{numberValue || '—'}</p>
      {statusValue && (
        <span className={`mb-1.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${PURCHASE_ORDER_STATUS_COLORS[statusValue] ?? ''}`}>
          {PURCHASE_ORDER_STATUS_LABELS[statusValue] ?? statusValue}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
        {currentUrl && (
          <a href={`/api/files?key=${encodeURIComponent(currentUrl)}&type=job`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            Ver
          </a>
        )}
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="text-brand hover:underline disabled:opacity-50">
          {busy ? 'Subiendo…' : currentUrl ? 'Reemplazar' : 'Adjuntar'}
        </button>
        {currentUrl && (
          <button type="button" disabled={busy} onClick={onUnlink} className="text-red-500 hover:underline disabled:opacity-50">
            Quitar
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  )
}

// OT/Informe: documentos gestionados en otro módulo (ticket de origen) —
// esta tarjeta solo refleja su estado real y enlaza al lugar donde viven,
// nunca duplica el archivo ni lo sube desde acá.
function LinkedDocSlot({
  label, moduleName, state, viewHref, manageHref, manageLabel,
}: {
  label: string
  moduleName: string
  state: DocState
  viewHref?: string
  manageHref?: string
  manageLabel: string
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
        <DocBadge state={state} />
      </div>
      <p className="mb-1.5 text-xs text-gray-400">Gestionado en {moduleName}</p>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
        {viewHref && (
          <a href={viewHref} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
            Ver
          </a>
        )}
        {manageHref && (
          <Link href={manageHref} className="text-brand hover:underline">
            {manageLabel}
          </Link>
        )}
      </div>
    </div>
  )
}
