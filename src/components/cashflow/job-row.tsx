'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CollectionChip } from './collection-chip'
import { JOB_TYPE_LABELS, COST_CATEGORY_LABELS } from '@/lib/cashflow/labels'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { getJobSummary } from '@/app/(app)/flujo/actions'
import { Modal } from '@/components/resources/modal'

type Cost = { id: string; category: string; amount: number; supplier: string | null; documentRef: string | null }
type Job = {
  id: string
  description: string | null
  type: string
  executionDate: Date | null
  netAmount: number | null
  collectionStatus: string
  branch: { name: string } | null
  client: { id: string; name: string }
  costs: Cost[]
}

type Summary = Awaited<ReturnType<typeof getJobSummary>>

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{value ?? '—'}</dd>
    </div>
  )
}

// Click en una fila abre el contexto completo del trabajo (cliente/sucursal/
// fechas/estado/técnico/plata/ticket) en un panel, sin navegar — antes solo
// se podían ver los costos inline y para todo lo demás había que ir a
// /flujo/trabajos/[id] y volver.
export function JobRow({ job, showClient }: { job: Job; showClient: boolean }) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isPending, startTransition] = useTransition()

  function openPanel() {
    setPanelOpen(true)
    if (!summary) startTransition(async () => setSummary(await getJobSummary(job.id)))
  }

  const totalCosts = job.costs.reduce((s, c) => s + c.amount, 0)
  const margin = (job.netAmount ?? 0) - totalCosts

  return (
    <>
      <tr onClick={openPanel} className="cursor-pointer border-b border-gray-100 transition-colors last:border-0 hover:bg-brand/[0.04]">
        <td className="px-4 py-2.5 text-gray-500">
          {job.executionDate ? toDateInput(job.executionDate) : '—'}
        </td>
        {showClient && (
          <td className="px-4 py-2.5 text-gray-600">{job.client.name}</td>
        )}
        <td className="px-4 py-2.5 text-gray-600">{job.branch?.name ?? '—'}</td>
        <td className="px-4 py-2.5 font-medium text-ink hover:text-brand-600 hover:underline">
          {job.description}
        </td>
        <td className="px-4 py-2.5 text-gray-600">
          {JOB_TYPE_LABELS[job.type] ?? job.type}
        </td>
        <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
          {clp(job.netAmount)}
        </td>
        <td className="px-4 py-2.5">
          <CollectionChip status={job.collectionStatus} />
        </td>
        <td className="px-2 py-2.5 text-gray-300">›</td>
      </tr>

      <Modal open={panelOpen} onClose={() => setPanelOpen(false)} title={job.description ?? 'Trabajo'} size="lg">
        {isPending && !summary ? (
          <p className="py-8 text-center text-sm text-gray-400">Cargando…</p>
        ) : summary ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <DetailRow label="Cliente" value={summary.client.name} />
              <DetailRow label="Sucursal" value={summary.branch?.name} />
              <DetailRow label="Tipo" value={JOB_TYPE_LABELS[summary.type] ?? summary.type} />
              <DetailRow label="Fecha ejecución" value={summary.executionDate ? toDateInput(summary.executionDate) : null} />
              <DetailRow label="Técnico" value={summary.technicianName ?? <span className="text-amber-600">Sin asignar</span>} />
              <DetailRow label="Estado" value={<CollectionChip status={summary.collectionStatus} />} />
              <DetailRow label="Código" value={summary.code} />
              <DetailRow label="Presupuesto" value={summary.quoteRef} />
              <DetailRow label="OC" value={summary.purchaseOrder} />
              <DetailRow label="Factura" value={summary.invoiceNumber} />
              <DetailRow label="Fecha factura" value={summary.invoiceDate ? toDateInput(summary.invoiceDate) : null} />
              <DetailRow label="Neto" value={clp(summary.netAmount)} />
            </div>

            {summary.originTicket && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Ticket de origen: <Link href={`/tickets/${summary.originTicket.id}`} className="font-semibold hover:underline">{summary.originTicket.ticketCode}</Link> — {summary.originTicket.title}
              </div>
            )}

            {summary.costs.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Costos registrados</p>
                <table className="w-full text-xs">
                  <tbody>
                    {summary.costs.map((c) => (
                      <tr key={c.id} className="border-t border-gray-100">
                        <td className="py-1.5 pr-4 text-gray-600">{COST_CATEGORY_LABELS[c.category] ?? c.category}</td>
                        <td className="py-1.5 pr-4 text-gray-500">{c.supplier ?? '—'}</td>
                        <td className="py-1.5 text-right tabular-nums text-gray-700">{clp(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 font-semibold">
                      <td colSpan={2} className="pt-1.5 text-gray-500">Total costos · Margen</td>
                      <td className="pt-1.5 text-right tabular-nums">
                        {clp(totalCosts)} <span className={margin >= 0 ? 'text-green-600' : 'text-red-600'}>({clp(margin)})</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="flex justify-end border-t border-gray-100 pt-3">
              <Link href={`/flujo/trabajos/${job.id}`} className="text-xs font-semibold text-brand hover:underline">
                Editar ficha completa →
              </Link>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No se pudo cargar el detalle.</p>
        )}
      </Modal>
    </>
  )
}
