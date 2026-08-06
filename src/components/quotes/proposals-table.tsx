'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Table, THead, TBody, Tr, Th, Td, TableEmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
    await fetch(`/api/client-documents?id=${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <>
      {/* La barra de acciones masivas (Task 11) se agrega justo acá, antes de <Table> — mismo componente, mismo `selected`, sin restructurar nada de este paso. Nunca dentro de <Table>: ver la nota de validez HTML arriba. */}
      <Table>
        <THead>
          <Tr>
            <Th>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer accent-brand"
                aria-label="Seleccionar todas"
              />
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
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className="h-4 w-4 cursor-pointer accent-brand"
                    aria-label={`Seleccionar ${d.title}`}
                  />
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
