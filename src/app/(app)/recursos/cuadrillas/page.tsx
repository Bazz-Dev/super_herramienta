import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/tenant'
import { listCrews } from '@/lib/resources/crews'
import { deleteCrew } from './actions'

export default async function CuadrillasPage() {
  const actor = await requireActor()
  const crews = await listCrews(actor)
  const isSuper = actor.role === 'super'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">← Recursos</Link>
          <h1 className="text-2xl font-bold">Cuadrillas</h1>
        </div>
        <Link
          href="/recursos/cuadrillas/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          <PlusIcon /> Nueva cuadrilla
        </Link>
      </div>

      {crews.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-400">Aún no hay cuadrillas. Crea la primera.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {crews.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-ink">
                    👷
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{c.name}</p>
                    {isSuper && <p className="text-xs uppercase tracking-wide text-gray-400">{c.tenant.slug}</p>}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.active ? 'bg-ok-100 text-ok-700' : 'bg-gray-100 text-gray-500'}`}>
                  {c.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {c.technicians.length} técnico{c.technicians.length !== 1 ? 's' : ''}
                </p>
                {c.technicians.length === 0 ? (
                  <p className="text-sm italic text-gray-400">Sin técnicos asignados</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {c.technicians.map((t) => (
                      <span key={t.id} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                <Link
                  href={`/recursos/cuadrillas/${c.id}`}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Editar
                </Link>
                <DeleteButton action={deleteCrew.bind(null, c.id)} confirmText={`¿Eliminar ${c.name}?`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
