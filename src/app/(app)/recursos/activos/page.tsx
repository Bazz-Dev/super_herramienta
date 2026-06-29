import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/tenant'
import { listAssets } from '@/lib/resources/assets'
import { ASSET_STATUS_BADGE, ASSET_STATUS_LABELS, type AssetStatusId } from '@/lib/resources/labels'
import { deleteAsset } from './actions'

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

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {assets.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {q ? 'Sin resultados.' : 'Aún no hay activos. Crea el primero.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Código</th>
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 font-medium">Camioneta</th>
                {isSuper && <th className="px-4 py-2.5 font-medium">Tenant</th>}
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{a.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.category ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {a.vehicle ? `${a.vehicle.plate}${a.vehicle.technician ? ` · ${a.vehicle.technician.name}` : ''}` : '—'}
                  </td>
                  {isSuper && <td className="px-4 py-2.5 uppercase text-gray-500">{a.tenant.slug}</td>}
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ASSET_STATUS_BADGE[a.status as AssetStatusId]}`}>
                      {ASSET_STATUS_LABELS[a.status as AssetStatusId]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/recursos/activos/${a.id}`}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                      <DeleteButton action={deleteAsset.bind(null, a.id)} confirmText={`¿Eliminar ${a.name}?`} />
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
