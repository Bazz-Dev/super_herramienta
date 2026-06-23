import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

type Actor = TenantActor

export async function listClientsForCashflow(actor: Actor) {
  const rows = await prisma.client.findMany({
    where: { ...tenantScope(actor), jobs: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return rows
}

export async function listJobs(
  actor: Actor,
  opts: { clientId?: string; from?: Date; to?: Date } = {},
) {
  return prisma.job.findMany({
    where: {
      ...tenantScope(actor),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.from || opts.to
        ? {
            executionDate: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    },
    include: { branch: true, costs: true },
    orderBy: [{ executionDate: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function getJob(actor: Actor, id: string) {
  return prisma.job.findFirst({
    where: { id, ...tenantScope(actor) },
    include: { branch: true, client: true, costs: { orderBy: { createdAt: 'desc' } } },
  })
}

export async function listBranches(actor: Actor, clientId: string) {
  return prisma.branch.findMany({
    where: { ...tenantScope(actor), clientId },
    orderBy: { name: 'asc' },
  })
}
