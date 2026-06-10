import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/resources/actor'
import { listVehicles } from '@/lib/resources/vehicles'
import { VEHICLE_STATUS_BADGE, VEHICLE_STATUS_LABELS, type VehicleStatusId } from '@/lib/resources/labels'
import { deleteVehicle } from './actions'

export default async function VehiculosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor()
  const { q } = await searchParams
  const vehicles = await listVehicles(actor, q)
  const isSuper = actor.role === 'super'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">← Recursos</Link>
          <h1 className="text-2xl font-bold">Vehículos / camionetas</h1>
        </div>
        <Link
          href="/recursos/vehiculos/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          <PlusIcon /> Nueva camioneta
        </Link>
      </div>

      <form className="mt-5" action="/recursos/vehiculos" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por patente, marca o modelo…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {vehicles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">{q ? 'Sin resultados.' : 'Aún no hay camionetas. Crea la primera.'}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Patente</th>
                <th className="px-4 py-2.5 font-medium">Vehículo</th>
                <th className="px-4 py-2.5 font-medium">Técnico</th>
                <th className="px-4 py-2.5 font-medium">Herramientas</th>
                {isSuper && <th className="px-4 py-2.5 font-medium">Tenant</th>}
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{v.plate}</td>
                  <td className="px-4 py-2.5 text-gray-600">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{v.technician?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{v._count.assets}</td>
                  {isSuper && <td className="px-4 py-2.5 uppercase text-gray-500">{v.tenant.slug}</td>}
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${VEHICLE_STATUS_BADGE[v.status as VehicleStatusId]}`}>
                      {VEHICLE_STATUS_LABELS[v.status as VehicleStatusId]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/recursos/vehiculos/${v.id}`}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                      <DeleteButton action={deleteVehicle.bind(null, v.id)} confirmText={`¿Eliminar ${v.plate}?`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
