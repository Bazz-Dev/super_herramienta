import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { listBranches } from '@/lib/cashflow/queries'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { JobForm } from '@/components/cashflow/job-form'
import { createJob } from '../../actions'

export default async function NewTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const actor = await requireActor()
  const { cliente } = await searchParams

  const allClients = await prisma.client.findMany({
    where: tenantScope(actor),
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const clientId =
    cliente && allClients.some((c) => c.id === cliente)
      ? cliente
      : allClients[0]?.id ?? ''

  const [branches, technicianRows] = await Promise.all([
    clientId ? listBranches(actor, clientId) : Promise.resolve([]),
    prisma.technician.findMany({
      where: { ...tenantScope(actor), active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/flujo/trabajos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Trabajos
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo trabajo</h1>

      {!clientId && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No hay clientes registrados.{' '}
          <Link href="/recursos/clientes/new" className="underline">
            Crear cliente
          </Link>
        </p>
      )}

      <JobForm
        action={createJob}
        branches={branches}
        technicians={technicianRows}
        clients={allClients}
        clientId={clientId}
      />
    </div>
  )
}
