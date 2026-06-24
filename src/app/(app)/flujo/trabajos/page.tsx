import Link from 'next/link'
import { requireActor } from '@/lib/resources/actor'
import { listJobs, listClientsForCashflow } from '@/lib/cashflow/queries'
import { JOB_TYPE_LABELS } from '@/lib/cashflow/labels'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { CollectionChip } from '@/components/cashflow/collection-chip'
import { ClientFilter } from '@/components/cashflow/client-filter'

const STATUS_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'sin_oc', label: 'Sin OC' },
  { value: 'pendiente_pago', label: 'Pendiente pago' },
  { value: 'pagado', label: 'Pagado' },
]

export default async function TrabajosPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; estado?: string }>
}) {
  const actor = await requireActor()
  const { cliente, estado } = await searchParams

  const [clients, jobs] = await Promise.all([
    listClientsForCashflow(actor),
    listJobs(actor, { clientId: cliente, collectionStatus: estado }),
  ])

  const totalNeto = jobs.reduce((s, j) => s + (j.netAmount ?? 0), 0)
  const showClientCol = !cliente && clients.length > 1

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/flujo" className="text-xs text-gray-400 hover:text-gray-600">
            ← Flujo
          </Link>
          <h1 className="text-2xl font-bold">Trabajos</h1>
        </div>
        <Link
          href="/flujo/trabajos/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          + Nuevo trabajo
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ClientFilter clients={clients} basePath="/flujo/trabajos" />
        {STATUS_OPTS.map((o) => {
          const params = new URLSearchParams()
          if (cliente) params.set('cliente', cliente)
          if (o.value) params.set('estado', o.value)
          const href = `/flujo/trabajos?${params.toString()}`
          const active = (estado ?? '') === o.value
          return (
            <Link
              key={o.value}
              href={href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-ink text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {o.label}
            </Link>
          )
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            Sin trabajos con este filtro.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Fecha ejec.</th>
                {showClientCol && <th className="px-4 py-2.5 font-medium">Cliente</th>}
                <th className="px-4 py-2.5 font-medium">Sucursal</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium text-right">Neto</th>
                <th className="px-4 py-2.5 font-medium">Estado pago</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr
                  key={j.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-2.5 text-gray-500">
                    {j.executionDate ? toDateInput(j.executionDate) : '—'}
                  </td>
                  {showClientCol && (
                    <td className="px-4 py-2.5 text-gray-600">{j.client.name}</td>
                  )}
                  <td className="px-4 py-2.5 text-gray-600">{j.branch.name}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    <Link
                      href={`/flujo/trabajos/${j.id}`}
                      className="hover:text-brand-600 hover:underline"
                    >
                      {j.description}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {JOB_TYPE_LABELS[j.type] ?? j.type}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {clp(j.netAmount)}
                  </td>
                  <td className="px-4 py-2.5">
                    <CollectionChip status={j.collectionStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td
                  colSpan={showClientCol ? 5 : 4}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-500"
                >
                  {jobs.length} {jobs.length === 1 ? 'trabajo' : 'trabajos'}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-ink">
                  {clp(totalNeto)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
