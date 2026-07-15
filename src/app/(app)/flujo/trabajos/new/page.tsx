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
  searchParams: Promise<{
    cliente?: string
    desc?: string
    sucursal?: string
    quoteRef?: string
    netAmount?: string
    ticketCode?: string
    ticketId?: string
  }>
}) {
  const actor = await requireActor()
  const { cliente, desc, sucursal, quoteRef, netAmount, ticketCode, ticketId } = await searchParams

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

  // Pre-fill from ticket/pipeline origin
  const resolvedBranchId = sucursal && branches.some((b) => b.id === sucursal) ? sucursal : undefined
  const parsedAmount = netAmount ? parseInt(netAmount, 10) : undefined
  const initial = (desc || resolvedBranchId || quoteRef || parsedAmount || ticketId)
    ? {
        description: desc ? decodeURIComponent(desc) : undefined,
        branchId: resolvedBranchId,
        quoteRef: quoteRef ? decodeURIComponent(quoteRef) : undefined,
        netAmount: parsedAmount && !isNaN(parsedAmount) ? parsedAmount : undefined,
        originTicketId: ticketId ?? null,
      }
    : undefined

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/flujo/trabajos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Trabajos
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo trabajo</h1>

      {ticketCode && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M6 5v3M6 10v1"/></svg>
          <span>Datos pre-llenados desde ticket <strong>{decodeURIComponent(ticketCode)}</strong></span>
        </div>
      )}

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
        initial={initial}
      />
    </div>
  )
}
