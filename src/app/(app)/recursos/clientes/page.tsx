import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/resources/actor'
import { listClients } from '@/lib/resources/clients'
import { CLIENT_LABELS } from '@/lib/resources/schemas'
import { deleteClient } from './actions'

function LabelBadge({ label }: { label: string | null }) {
  if (!label) return null
  const cfg = CLIENT_LABELS.find((l) => l.value === label)
  if (!cfg) return null
  return (
    <span className={`ml-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const actor = await requireActor()
  const { q } = await searchParams
  const clients = await listClients(actor, q)
  const isSuper = actor.role === 'super'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">
            ← Recursos
          </Link>
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
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {q ? 'Sin resultados.' : 'Aún no hay clientes. Crea el primero.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">RUT</th>
                <th className="px-4 py-2.5 font-medium">Contacto</th>
                <th className="px-4 py-2.5 font-medium text-right">Flujo</th>
                <th className="px-4 py-2.5 font-medium text-right">Sucursales</th>
                <th className="px-4 py-2.5 font-medium text-right">Cronograma</th>
                {isSuper && <th className="px-4 py-2.5 font-medium">Tenant</th>}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/recursos/clientes/${c.id}`}
                      className="font-semibold text-ink hover:text-brand-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <LabelBadge label={c.label ?? null} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.rut ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.contact ?? c.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    {c._count.jobs > 0 ? (
                      <Link
                        href={`/flujo?cliente=${c.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {c._count.jobs} trabajos
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c._count.branches > 0 ? (
                      <Link
                        href={`/flujo/sucursales?cliente=${c.id}`}
                        className="text-gray-600 hover:text-ink hover:underline"
                      >
                        {c._count.branches}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">
                    {c._count.assignments > 0 ? c._count.assignments : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  {isSuper && (
                    <td className="px-4 py-2.5 uppercase text-gray-500">{c.tenant.slug}</td>
                  )}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/recursos/clientes/${c.id}`}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                      <DeleteButton
                        action={deleteClient.bind(null, c.id)}
                        confirmText={`¿Eliminar ${c.name}?`}
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
