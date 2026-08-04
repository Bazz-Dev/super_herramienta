import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { listBranches } from '@/lib/cashflow/queries'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { JobForm } from '@/components/cashflow/job-form'
import { createJob } from '../../actions'
import { comercialState } from '@/lib/tickets/ticket-state-summary'

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
    proposalId?: string
    processFlow?: string
  }>
}) {
  const actor = await requireActor()
  const { cliente, desc, sucursal, quoteRef, netAmount, ticketCode, ticketId, proposalId, processFlow } = await searchParams

  const allClients = await prisma.client.findMany({
    where: tenantScope(actor),
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const clientId =
    cliente && allClients.some((c) => c.id === cliente)
      ? cliente
      : allClients[0]?.id ?? ''

  const [branches, technicianRows, existingJobsFromProposal, proposalDoc, ticketOptions] = await Promise.all([
    clientId ? listBranches(actor, clientId) : Promise.resolve([]),
    prisma.technician.findMany({
      where: { ...tenantScope(actor), active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    proposalId
      ? prisma.job.count({ where: { originProposalId: proposalId, ...tenantScope(actor) } })
      : Promise.resolve(0),
    // Si la propuesta ya tiene ticket (obligatorio desde Etapa 1c para
    // propuestas nuevas), lo heredamos — evita reseleccionar a mano lo que
    // ya se sabe. proposalStatus también, para heredar la etapa comercial
    // real (ver más abajo).
    proposalId
      ? prisma.clientDocument.findFirst({ where: { id: proposalId, ...tenantScope(actor) }, select: { ticketId: true, proposalStatus: true } })
      : Promise.resolve(null),
    // Ticket de origen obligatorio para trabajos nuevos (informe #1) — scopeado
    // al cliente actual, mismo patrón que branches.
    clientId
      ? prisma.ticket.findMany({
          where: { clientId, ...tenantScope(actor), deletedAt: null, status: { notIn: ['cancelado', 'fusionado'] } },
          select: { id: true, ticketCode: true, title: true },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  // Heredar la etapa comercial real del ticket de origen (bloque de release,
  // Gate 1): antes, un trabajo nuevo SIEMPRE nacía en commercialStage='intake'
  // (default del schema) aunque el ticket ya mostrara "Comercial: Aprobada"
  // (propuesta aceptada en Pipeline) — el ticket quedaba desincronizado del
  // trabajo recién creado. Reusa comercialState(), el mismo cálculo canónico
  // que ya usa la ficha del ticket — no se inventa una regla nueva. Solo se
  // siembra al CREAR (mismo patrón ya establecido para processFlow, informe
  // #2) — no es un sync continuo, así que no reintroduce el problema de
  // "dos sistemas de estado en paralelo" documentado en ARQUITECTURA.md.
  const originTicketId = ticketId ?? proposalDoc?.ticketId ?? null
  const originatingProposal = proposalId
    ? proposalDoc
    : originTicketId
      ? await prisma.clientDocument.findFirst({
          where: { ticketId: originTicketId, type: 'propuesta', ...tenantScope(actor) },
          select: { proposalStatus: true },
          orderBy: { createdAt: 'desc' },
        })
      : null
  const originTicketForState = originTicketId
    ? await prisma.ticket.findFirst({ where: { id: originTicketId, ...tenantScope(actor) }, select: { processFlow: true, status: true } })
    : null
  const inheritedCommercialStage =
    originatingProposal && comercialState(null, originatingProposal, originTicketForState ?? undefined) === 'aprobada'
      ? 'approved'
      : undefined

  // Pre-fill from ticket/pipeline origin
  const resolvedBranchId = sucursal && branches.some((b) => b.id === sucursal) ? sucursal : undefined
  const parsedAmount = netAmount ? parseInt(netAmount, 10) : undefined
  const initial = (desc || resolvedBranchId || quoteRef || parsedAmount || ticketId || proposalId)
    ? {
        description: desc ? decodeURIComponent(desc) : undefined,
        branchId: resolvedBranchId,
        quoteRef: quoteRef ? decodeURIComponent(quoteRef) : undefined,
        netAmount: parsedAmount && !isNaN(parsedAmount) ? parsedAmount : undefined,
        originTicketId: ticketId ?? proposalDoc?.ticketId ?? null,
        originProposalId: proposalId ?? null,
        processFlow: processFlow === 'pre_quote' || processFlow === 'post_execution' ? processFlow : undefined,
        commercialStage: inheritedCommercialStage,
      }
    : undefined

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/flujo" className="text-xs text-gray-400 hover:text-gray-600">
        ← Flujo
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo trabajo</h1>

      {ticketCode && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M6 5v3M6 10v1"/></svg>
          <span>Datos pre-llenados desde ticket <strong>{decodeURIComponent(ticketCode)}</strong></span>
        </div>
      )}

      {proposalId && existingJobsFromProposal > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M8 1.5 1 14h14L8 1.5Z"/><path d="M8 6.5v3.5M8 12.2v.1"/></svg>
          <span>Ya hay {existingJobsFromProposal} trabajo(s) creado(s) desde esta propuesta — revisa antes de crear otro.</span>
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
        tickets={ticketOptions}
      />
    </div>
  )
}
