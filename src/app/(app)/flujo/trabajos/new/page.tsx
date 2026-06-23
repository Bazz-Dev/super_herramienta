import Link from 'next/link'
import { requireActor } from '@/lib/resources/actor'
import { listBranches, listClientsForCashflow } from '@/lib/cashflow/queries'
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

  // Resolve clientId: prefer ?cliente= param, then first client with jobs,
  // then fall back to any tenant client (so first job creation works)
  const jobClients = await listClientsForCashflow(actor)
  let clientId = cliente ?? jobClients[0]?.id ?? ''
  if (!clientId) {
    const anyClient = await prisma.client.findFirst({
      where: tenantScope(actor),
      select: { id: true },
      orderBy: { name: 'asc' },
    })
    clientId = anyClient?.id ?? ''
  }

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
          No hay clientes con trabajos registrados. Crea al menos un cliente y una sucursal primero.
        </p>
      )}

      <JobForm
        action={createJob}
        branches={branches}
        technicians={technicianRows}
        clientId={clientId}
      />
    </div>
  )
}
