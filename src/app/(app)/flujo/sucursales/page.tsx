import Link from 'next/link'
import { auth } from '@/auth'
import { listBranches } from '@/lib/cashflow/queries'
import { listClients } from '@/lib/resources/clients'
import { createBranch, deleteBranch } from '@/app/(app)/flujo/actions'
import { BranchForm } from '@/components/cashflow/branch-form'
import { DeleteButton } from '@/components/resources/delete-button'

export default async function SucursalesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const session = await auth()
  const actor = session!.user
  const { cliente } = await searchParams

  const clients = await listClients(actor)

  // Resolve active clientId: from ?cliente= param, or first client
  const clientId = (cliente && clients.some((c) => c.id === cliente))
    ? cliente
    : clients[0]?.id ?? ''

  const branches = clientId ? await listBranches(actor, clientId) : []

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/flujo"
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ink"
        >
          ← Flujo
        </Link>
        <h1 className="text-2xl font-bold">Sucursales</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestiona las sucursales por cliente para asociarlas a trabajos.
        </p>
      </div>

      {/* Client tabs / filter */}
      {clients.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2">
          {clients.map((c) => (
            <Link
              key={c.id}
              href={`/flujo/sucursales?cliente=${c.id}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors duration-150 ${
                c.id === clientId
                  ? 'bg-brand text-ink'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {/* Branch list */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Sucursales existentes
        </h2>

        {branches.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            {clientId
              ? 'Sin sucursales para este cliente. Agrega la primera abajo.'
              : 'Selecciona un cliente para ver sus sucursales.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {branches.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{b.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      b.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {b.active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <DeleteButton
                  action={deleteBranch.bind(null, b.id)}
                  confirmText={`¿Eliminar sucursal "${b.name}"?`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add branch form */}
      {clientId && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Agregar sucursal
          </h2>
          <BranchForm
            action={createBranch}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            clientId={clientId}
          />
        </section>
      )}

      {clients.length === 0 && (
        <p className="text-sm text-gray-500">
          No hay clientes registrados.{' '}
          <Link href="/recursos/clientes/new" className="text-brand underline">
            Crear cliente
          </Link>
        </p>
      )}
    </div>
  )
}
