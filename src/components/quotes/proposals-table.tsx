'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Table, THead, TBody, Tr, Th, Td, TableEmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { buttonClass } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { DocumentQuickPreview } from '@/components/quotes/document-quick-preview'
import { formatMoney } from '@/lib/quotes/format'
import { PROCESS_FLOW_LABELS, PROCESS_FLOW_COLORS } from '@/lib/cashflow/labels'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_BADGE } from '@/lib/pipeline/labels'
import type { ProposalStatus } from '@/generated/prisma/enums'

export type ProposalRow = {
  id: string
  title: string
  quoteId: string | null
  createdAt: Date
  proposalStatus: ProposalStatus | null
  client: { name: string }
  ticket: { id: string; ticketCode: string; processFlow: 'pre_quote' | 'post_execution' | null; branch: { name: string } | null } | null
  displayAmount: number | null
  displayCurrency: 'CLP' | 'UF' | 'USD'
}

export function ProposalsTable({ docs, hasFilters }: { docs: ProposalRow[]; hasFilters: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  // Comparar tamaños (selected.size === docs.length) parece equivalente pero
  // no lo es: tras eliminar una fila seleccionada + refresh, un id fantasma
  // puede quedar en `selected` y el tamaño coincidir con docs.length por
  // casualidad, dejando el checkbox "seleccionar todas" marcado con filas
  // reales sin marcar (bug real, encontrado en la verificación en vivo de
  // esta tarea). Comparar membresía real evita eso.
  const allSelected = docs.length > 0 && docs.every((d) => selected.has(d.id))
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(docs.map((d) => d.id)))
  }

  async function deleteOne(id: string) {
    const res = await fetch(`/api/client-documents?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Error ${res.status} al eliminar`)
    }
    router.refresh()
  }

  const [bulkBusy, setBulkBusy] = useState<'download' | 'print' | 'delete' | null>(null)
  const [bulkError, setBulkError] = useState('')

  async function downloadSelected() {
    setBulkBusy('download')
    setBulkError('')
    try {
      const res = await fetch('/api/quotes/zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status} al generar el ZIP`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'Propuestas.zip'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Error al descargar el ZIP')
    } finally {
      setBulkBusy(null)
    }
  }

  // Impresión masiva: mismo PDF consolidado que produciría abrir cada uno y
  // usar "Imprimir" del visor del navegador — más simple que generar un PDF
  // fusionado server-side para un caso de uso que ya funciona bien así
  // (ponytail: el navegador ya sabe fusionar/paginar N pestañas de
  // impresión, no hay que reinventarlo). Cada PDF se abre en una pestaña
  // nueva lista para Ctrl+P.
  async function printSelected() {
    setBulkBusy('print')
    setBulkError('')
    let failed = 0
    for (const id of selected) {
      try {
        const res = await fetch(`/api/client-documents?id=${id}`)
        if (!res.ok) throw new Error()
        const { dataJson } = await res.json()
        if (!dataJson) throw new Error()
        const pdfRes = await fetch('/api/quotes/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: dataJson,
        })
        if (!pdfRes.ok) throw new Error()
        const blob = await pdfRes.blob()
        // window.open() tras un await pierde el "user gesture" original — los
        // navegadores lo bloquean en vez de lanzar, devolviendo null (no una
        // excepción), así que el try/catch de este bloque nunca lo ve. Hay
        // que chequear el valor de retorno a mano.
        if (!window.open(URL.createObjectURL(blob), '_blank')) throw new Error()
      } catch {
        failed++
      }
    }
    if (failed > 0) setBulkError(`${failed} de ${selected.size} no se pudieron abrir para imprimir (el navegador puede estar bloqueando ventanas emergentes)`)
    setBulkBusy(null)
  }

  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)

  async function deleteSelected() {
    setConfirmingBulkDelete(false)
    setBulkBusy('delete')
    setBulkError('')
    try {
      const ids = [...selected]
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/client-documents?id=${id}`, { method: 'DELETE' }).then((res) => ({ id, ok: res.ok }))),
      )
      const failedIds = results.filter((r) => !r.ok).map((r) => r.id)
      // Deja seleccionadas solo las que fallaron — éxito total limpia la
      // selección y oculta la barra, éxito parcial la deja abierta mostrando
      // cuántas quedan pendientes en vez de fingir que todo salió bien.
      setSelected(new Set(failedIds))
      if (failedIds.length > 0) setBulkError(`${failedIds.length} de ${ids.length} no se pudieron eliminar`)
      router.refresh()
    } finally {
      setBulkBusy(null)
    }
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="mb-2 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong className="text-sm text-amber-900">{selected.size} seleccionadas</strong>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!bulkBusy} onClick={downloadSelected} className={buttonClass('secondary', 'md')}>
                {bulkBusy === 'download' ? <Spinner size={14} /> : 'Descargar'}
              </button>
              <button type="button" disabled={!!bulkBusy} onClick={printSelected} className={buttonClass('secondary', 'md')}>
                {bulkBusy === 'print' ? <Spinner size={14} /> : 'Imprimir'}
              </button>
              {!confirmingBulkDelete ? (
                <button type="button" disabled={!!bulkBusy} onClick={() => setConfirmingBulkDelete(true)} className={buttonClass('danger', 'md')}>
                  Eliminar
                </button>
              ) : (
                <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2">
                  <span className="text-xs font-medium text-red-700">¿Eliminar {selected.size} propuestas? No se reutilizarán sus números.</span>
                  <button type="button" disabled={!!bulkBusy} onClick={() => setConfirmingBulkDelete(false)} className={buttonClass('ghost', 'md')}>No</button>
                  <button type="button" disabled={!!bulkBusy} onClick={deleteSelected} className={buttonClass('danger', 'md')}>
                    {bulkBusy === 'delete' ? <Spinner size={14} /> : 'Sí, eliminar'}
                  </button>
                </div>
              )}
              <button type="button" onClick={() => { setSelected(new Set()); setBulkError(''); setConfirmingBulkDelete(false) }} className={buttonClass('ghost', 'md')}>
                Limpiar selección
              </button>
            </div>
          </div>
          {bulkError && <span className="text-xs font-medium text-red-700">{bulkError}</span>}
        </div>
      )}
      <Table>
        <THead>
          <Tr>
            <Th>
              <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer accent-brand"
                  aria-label="Seleccionar todas"
                />
              </label>
            </Th>
            <Th>Documento</Th>
            <Th>N° presupuesto</Th>
            <Th>Cliente</Th>
            <Th>Sucursal</Th>
            <Th>Fecha</Th>
            <Th>Ticket asociado</Th>
            <Th>PP/ED</Th>
            <Th>Estado</Th>
            <Th className="text-right">Monto</Th>
          </Tr>
        </THead>
        <TBody>
          {docs.length === 0 ? (
            <TableEmptyRow colSpan={10}>
              {hasFilters ? 'Sin resultados para estos filtros' : 'Sin propuestas creadas todavía'}
            </TableEmptyRow>
          ) : (
            docs.map((d) => (
              <Tr key={d.id}>
                <Td>
                  <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggle(d.id)}
                      className="h-4 w-4 cursor-pointer accent-brand"
                      aria-label={`Seleccionar ${d.title}`}
                    />
                  </label>
                </Td>
                <Td>
                  <DocumentQuickPreview
                    docId={d.id} title={d.title} documentType="propuesta" editHref={`/cotizador?docId=${d.id}`}
                    ticketCode={d.ticket?.ticketCode} number={d.quoteId}
                    trigger={<span className="inline-flex items-center gap-1">📄 DOC</span>}
                    triggerClassName="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand/20"
                    onDelete={() => deleteOne(d.id)}
                  />
                </Td>
                <Td className="tabular-nums">{d.quoteId ?? <span className="text-gray-300">—</span>}</Td>
                <Td>{d.client.name}</Td>
                <Td>{d.ticket?.branch?.name ?? <span className="text-gray-300">—</span>}</Td>
                <Td className="text-gray-500">{d.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</Td>
                <Td>
                  {d.ticket ? (
                    <Link href={`/tickets/${d.ticket.id}`} className="text-brand hover:underline">{d.ticket.ticketCode}</Link>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td>
                  {d.ticket?.processFlow ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PROCESS_FLOW_COLORS[d.ticket.processFlow] ?? 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                      {PROCESS_FLOW_LABELS[d.ticket.processFlow] ?? d.ticket.processFlow}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td>
                  {d.proposalStatus ? (
                    <Badge {...PROPOSAL_STATUS_BADGE[d.proposalStatus]}>{PROPOSAL_STATUS_LABELS[d.proposalStatus]}</Badge>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td className="text-right tabular-nums">{d.displayAmount ? formatMoney(d.displayAmount, d.displayCurrency) : '—'}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>
    </>
  )
}
