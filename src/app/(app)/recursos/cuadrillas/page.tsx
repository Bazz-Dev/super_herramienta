import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/resources/actor'
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

      <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {crews.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Aún no hay cuadrillas. Crea la primera.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Técnicos</th>
                {isSuper && <th className="px-4 py-2.5 font-medium">Tenant</th>}
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {crews.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {c.technicians.length === 0 ? '—' : c.technicians.map((t) => t.name).join(', ')}
                  </td>
                  {isSuper && <td className="px-4 py-2.5 uppercase text-gray-500">{c.tenant.slug}</td>}
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/recursos/cuadrillas/${c.id}`}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                      <DeleteButton action={deleteCrew.bind(null, c.id)} confirmText={`¿Eliminar ${c.name}?`} />
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
