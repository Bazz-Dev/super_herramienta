import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/resources/actor'
import { listTechnicians } from '@/lib/resources/technicians'
import { deleteTechnician } from './actions'

export default async function TecnicosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const actor = await requireActor()
  const { q } = await searchParams
  const technicians = await listTechnicians(actor, q)
  const isSuper = actor.role === 'super'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">
            ← Recursos
          </Link>
          <h1 className="text-2xl font-bold">Técnicos</h1>
        </div>
        <Link
          href="/recursos/tecnicos/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          <PlusIcon /> Nuevo técnico
        </Link>
      </div>

      <form className="mt-5" action="/recursos/tecnicos" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre, especialidad o RUT…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {technicians.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {q ? 'Sin resultados para tu búsqueda.' : 'Aún no hay técnicos. Crea el primero.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Especialidad</th>
                <th className="px-4 py-2.5 font-medium">Contacto</th>
                {isSuper && <th className="px-4 py-2.5 font-medium">Tenant</th>}
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((t) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{t.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{t.specialty ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {t.email ?? t.phone ?? '—'}
                  </td>
                  {isSuper && <td className="px-4 py-2.5 uppercase text-gray-500">{t.tenant.slug}</td>}
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {t.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/recursos/tecnicos/${t.id}`}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                      <DeleteButton
                        action={deleteTechnician.bind(null, t.id)}
                        confirmText={`¿Eliminar a ${t.name}?`}
                      />
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
