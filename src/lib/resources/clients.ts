import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

export async function listClients(actor: TenantActor, search?: string) {
  const q = search?.trim()
  return prisma.client.findMany({
    where: {
      ...tenantScope(actor),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { rut: { contains: q } },
              { contact: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      tenant: { select: { slug: true } },
      _count: { select: { jobs: true, branches: true, assignments: true } },
      ruts: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: [{ name: 'asc' }],
  })
}

export async function getClient(actor: TenantActor, id: string) {
  return prisma.client.findFirst({ where: { id, ...tenantScope(actor) } })
}

export async function getClientWithStats(actor: TenantActor, id: string) {
  const client = await prisma.client.findFirst({
    where: { id, ...tenantScope(actor) },
    include: {
      _count: { select: { jobs: true, branches: true, assignments: true } },
      branches: { orderBy: { name: 'asc' }, select: { id: true, name: true, city: true, active: true } },
      ruts: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!client) return null

  // Aggregate flujo KPIs in a single query
  const jobAgg = await prisma.job.groupBy({
    by: ['collectionStatus'],
    where: { clientId: id, ...tenantScope(actor) },
    _sum: { netAmount: true },
    _count: { _all: true },
    _max: { executionDate: true },
  })

  let facturado = 0
  let cobrado = 0
  let porCobrar = 0
  let sinOc = 0
  let lastExecution: Date | null = null

  for (const row of jobAgg) {
    const amount = row._sum.netAmount ?? 0
    if (row.collectionStatus === 'sin_oc') sinOc += amount
    else facturado += amount
    if (row.collectionStatus === 'pagado') cobrado += amount
    if (row.collectionStatus === 'pendiente_pago') porCobrar += amount
    const d = row._max.executionDate
    if (d && (!lastExecution || d > lastExecution)) lastExecution = d
  }

  return { ...client, flujo: { facturado, cobrado, porCobrar, sinOc, lastExecution } }
}

export type ClientListItem = Awaited<ReturnType<typeof listClients>>[number]
export type ClientWithStats = NonNullable<Awaited<ReturnType<typeof getClientWithStats>>>
