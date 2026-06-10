import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/resources/actor'
import { listClients } from '@/lib/resources/clients'
import { deleteClient } from './actions'

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor()
  const { q } = await searchParams
  const clients = await listClients(actor, q)
  const isSuper = actor.role === 'super'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">← Recursos</Link>
          <h1 className="text-2xl font-bold">Clientes</h1>
        </div>
        <Link
          href="/recursos/clientes/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          <PlusIcon /> Nuevo cliente
        </Link>
      </div>

      <form className="mt-5" action="/recursos/clientes" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre, RUT o contacto…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {clients.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">{q ? 'Sin resultados.' : 'Aún no hay clientes. Crea el primero.'}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">RUT</th>
                <th className="px-4 py-2.5 font-medium">Contacto</th>
                <th className="px-4 py-2.5 font-medium">Trabajos</th>
                {isSuper && <th className="px-4 py-2.5 font-medium">Tenant</th>}
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.rut ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.contact ?? c.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c._count.assignments}</td>
                  {isSuper && <td className="px-4 py-2.5 uppercase text-gray-500">{c.tenant.slug}</td>}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/recursos/clientes/${c.id}`}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                      <DeleteButton action={deleteClient.bind(null, c.id)} confirmText={`¿Eliminar ${c.name}?`} />
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
