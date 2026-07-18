import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/tenant'
import { listAssets } from '@/lib/resources/assets'
import { ASSET_STATUS_BADGE, ASSET_STATUS_LABELS, type AssetStatusId } from '@/lib/resources/labels'
import { deleteAsset } from './actions'

const ASSET_STATUS_BAR: Record<AssetStatusId, string> = {
  available: 'bg-green-500',
  in_use: 'bg-blue-500',
  maintenance: 'bg-amber-400',
  retired: 'bg-gray-300',
}

export default async function ActivosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor()
  const { q } = await searchParams
  const assets = await listAssets(actor, q)
  const isSuper = actor.role === 'super'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">← Recursos</Link>
          <h1 className="text-2xl font-bold">Maquinaria / activos</h1>
        </div>
        <Link
          href="/recursos/activos/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          <PlusIcon /> Nuevo activo
        </Link>
      </div>

      <form className="mt-5" action="/recursos/activos" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre, código o categoría…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </form>

      {assets.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-400">{q ? 'Sin resultados.' : 'Aún no hay activos. Crea el primero.'}</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => {
            const status = a.status as AssetStatusId
            return (
              <div key={a.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
                <div className={`h-1.5 w-full ${ASSET_STATUS_BAR[status]}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{a.name}</p>
                      <p className="text-xs text-gray-500">{a.code ?? 'Sin código'}{a.category ? ` · ${a.category}` : ''}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${ASSET_STATUS_BADGE[status]}`}>
                      {ASSET_STATUS_LABELS[status]}
                    </span>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-base leading-none">🚗</span>
                      {a.vehicle ? (
                        <Link href={`/recursos/vehiculos/${a.vehicle.id}`} className="font-medium hover:text-brand hover:underline">
                          {a.vehicle.plate}{a.vehicle.technician ? ` · ${a.vehicle.technician.name}` : ''}
                        </Link>
                      ) : (
                        <span className="italic text-gray-400">Sin camioneta asignada</span>
                      )}
                    </div>
                    {isSuper && <p className="mt-1.5 text-xs uppercase tracking-wide text-gray-400">{a.tenant.slug}</p>}
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                    <Link
                      href={`/recursos/activos/${a.id}`}
                      className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      Editar
                    </Link>
                    <DeleteButton action={deleteAsset.bind(null, a.id)} confirmText={`¿Eliminar ${a.name}?`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
