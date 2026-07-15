import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'
import type { CollectionStatus, JobType } from '@/generated/prisma/enums'

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
  opts: {
    clientId?: string
    collectionStatus?: string
    from?: Date
    to?: Date
    tipo?: string
    branchId?: string
  } = {},
) {
  return prisma.job.findMany({
    where: {
      ...tenantScope(actor),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.collectionStatus ? { collectionStatus: opts.collectionStatus as CollectionStatus } : {}),
      ...(opts.tipo ? { type: opts.tipo as JobType } : {}),
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.from || opts.to
        ? {
            executionDate: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lte: opts.to } : {}),
            },
          }
        : {}),
    },
    include: { branch: true, client: { select: { id: true, name: true } }, costs: true },
    orderBy: [{ executionDate: 'desc' }, { createdAt: 'desc' }],
  })
}

export async function listBranchesForClient(actor: Actor, clientId: string) {
  return prisma.branch.findMany({
    where: { ...tenantScope(actor), clientId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

export async function getJob(actor: Actor, id: string) {
  return prisma.job.findFirst({
    where: { id, ...tenantScope(actor) },
    include: {
      branch: true,
      client: true,
      costs: { orderBy: { createdAt: 'desc' } },
      originTicket: { select: { id: true, ticketCode: true, title: true, status: true } },
    },
  })
}

export async function listBranches(actor: Actor, clientId: string) {
  return prisma.branch.findMany({
    where: { ...tenantScope(actor), clientId },
    orderBy: { name: 'asc' },
  })
}

export async function getClientSummaries(actor: Actor, from?: Date) {
  return prisma.job.findMany({
    where: { ...tenantScope(actor), ...(from ? { executionDate: { gte: from } } : {}) },
    select: {
      clientId: true,
      client: { select: { name: true } },
      netAmount: true,
      taxAmount: true,
      collectionStatus: true,
      invoiceDate: true,
      paymentDate: true,
      creditDays: true,
      executionDate: true,
      type: true,
      branchId: true,
      technicianId: true,
      costs: { select: { amount: true } },
    },
  })
}

export async function getMonthlySummary(actor: Actor, months = 12, fromOverride?: Date) {
  const from = fromOverride ?? (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - months + 1)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })()

  return prisma.job.findMany({
    where: {
      ...tenantScope(actor),
      ...(from ? { executionDate: { gte: from } } : {}),
    },
    select: {
      executionDate: true,
      netAmount: true,
      collectionStatus: true,
      clientId: true,
      client: { select: { name: true } },
    },
    orderBy: { executionDate: 'asc' },
  })
}
