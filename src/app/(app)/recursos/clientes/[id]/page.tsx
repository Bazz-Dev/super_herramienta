import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClientForm } from '@/components/resources/client-form'
import { BranchManager } from '@/components/resources/branch-manager'
import { requireActor } from '@/lib/tenant'
import { getClientWithStats } from '@/lib/resources/clients'
import { updateClient } from '../actions'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'

export default async function EditClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireActor()
  const { id } = await params
  const client = await getClientWithStats(actor, id)
  if (!client) notFound()

  const { flujo } = client
  const totalVolumen = flujo.facturado + flujo.sinOc
  const cobradoPct =
    flujo.facturado > 0 ? Math.round((flujo.cobrado / flujo.facturado) * 100) : null

  const hasJobs = client._count.jobs > 0

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/recursos/clientes" className="text-xs text-gray-400 hover:text-gray-600">
        ← Clientes
      </Link>
      <div className="mt-1 mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">{client.name}</h1>
        <div className="flex items-center gap-2">
          {hasJobs && (
            <Link
              href={`/flujo?cliente=${client.id}`}
              className="rounded-md border border-brand bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand/20"
            >
              Ver en Flujo de Caja →
            </Link>
          )}
          {client._count.assignments > 0 && (
            <Link
              href={`/cronograma?cliente=${client.id}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Ver en Cronograma →
            </Link>
          )}
        </div>
      </div>

      {/* Activity panel */}
      {hasJobs && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Actividad financiera
          </h2>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Volumen total</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-ink">
                {clp(totalVolumen)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Cobrado</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-green-700">
                {clp(flujo.cobrado)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Por cobrar</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-amber-700">
                {clp(flujo.porCobrar)}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Sin OC</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-red-600">
                {clp(flujo.sinOc)}
              </p>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            <span>
              <span className="font-medium text-gray-700">{client._count.jobs}</span> trabajos registrados
            </span>
            <span>
              <span className="font-medium text-gray-700">{client._count.branches}</span> sucursales
            </span>
            {cobradoPct != null && (
              <span>
                Tasa de cobro:{' '}
                <span
                  className={`font-semibold ${cobradoPct >= 80 ? 'text-green-700' : 'text-amber-700'}`}
                >
                  {cobradoPct}%
                </span>
              </span>
            )}
            {flujo.lastExecution && (
              <span>
                Último trabajo:{' '}
                <span className="font-medium text-gray-700">
                  {toDateInput(flujo.lastExecution)}
                </span>
              </span>
            )}
          </div>

          <BranchManager clientId={client.id} branches={client.branches} />

          <div className="mt-3 flex gap-3 border-t border-gray-100 pt-3">
            <Link
              href={`/flujo/trabajos?cliente=${client.id}`}
              className="text-xs text-gray-500 hover:text-ink hover:underline"
            >
              Ver todos los trabajos →
            </Link>
            <Link
              href={`/flujo/sucursales?cliente=${client.id}`}
              className="text-xs text-gray-500 hover:text-ink hover:underline"
            >
              Gestionar sucursales →
            </Link>
            <Link
              href={`/flujo/trabajos/new?cliente=${client.id}`}
              className="text-xs text-brand-700 font-medium hover:underline"
            >
              + Nuevo trabajo →
            </Link>
          </div>
        </div>
      )}

      {/* Edit form */}
      <h2 className="mb-4 text-base font-semibold text-ink">Datos del cliente</h2>
      <ClientForm
        action={updateClient.bind(null, client.id)}
        initial={client}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
