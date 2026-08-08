import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'
import type { CollectionStatus, JobType, ProcessFlow, FinancialStage } from '@/generated/prisma/enums'

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
    processFlow?: string
    financialStage?: string
    sinTecnico?: boolean
  } = {},
) {
  return prisma.job.findMany({
    where: {
      ...tenantScope(actor),
      ...(opts.clientId ? { clientId: opts.clientId } : {}),
      ...(opts.collectionStatus ? { collectionStatus: opts.collectionStatus as CollectionStatus } : {}),
      ...(opts.tipo ? { type: opts.tipo as JobType } : {}),
      ...(opts.branchId ? { branchId: opts.branchId } : {}),
      ...(opts.processFlow ? { processFlow: opts.processFlow as ProcessFlow } : {}),
      ...(opts.financialStage ? { financialStage: opts.financialStage as FinancialStage } : {}),
      ...(opts.sinTecnico ? { technicianId: null } : {}),
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

// "Control de hoy" en /flujo (facturas vencidas, vencen en 7 días, sin OC,
// etc.) corre SIN filtro de período en cada carga de la página — antes
// reusaba listJobs(), que siempre trae include:{branch,client,costs}. Los
// predicados de job-presets.ts (ver su tipo Job) solo leen campos escalares
// (+ installments), nunca esas 3 relaciones: para el tenant completo (rol
// super, tenantScope() = {}) eso era un join innecesario contra la tabla de
// trabajos entera en cada visita a /flujo, sin importar qué filtro se
// cambiara — el costo real detrás de "los filtros son lentos".
export async function listJobsForControl(actor: Actor, clientId?: string) {
  return prisma.job.findMany({
    where: { ...tenantScope(actor), ...(clientId ? { clientId } : {}) },
    select: {
      financialStage: true, commercialStage: true, operationalStage: true, nonBillable: true,
      netAmount: true, purchaseOrder: true, purchaseOrderStatus: true,
      invoiceNumber: true, invoiceDate: true, invoiceStatus: true,
      paymentDate: true, paymentAmount: true, executionDate: true, creditDays: true, technicianId: true,
      status: true, collectionStatus: true,
      installments: {
        select: {
          netAmount: true, purchaseOrder: true, purchaseOrderStatus: true,
          invoiceNumber: true, invoiceDate: true, invoiceStatus: true,
          creditDays: true, paymentDate: true, paymentAmount: true,
        },
      },
    },
  })
}

export async function listBranchesForClient(actor: Actor, clientId: string) {
  return prisma.branch.findMany({
    where: { ...tenantScope(actor), clientId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
}

// Todas las sucursales del tenant (con clientId) — usada por la edición
// rápida del acordeón de /flujo, que mezcla trabajos de varios clientes en
// una sola lista y necesita filtrar el selector de sucursal por el cliente
// de cada trabajo sin una consulta por tarjeta.
export async function listAllBranches(actor: Actor) {
  return prisma.branch.findMany({
    where: tenantScope(actor),
    select: { id: true, name: true, clientId: true },
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
      installments: { orderBy: { sequence: 'asc' } },
      originTicket: { select: { id: true, ticketCode: true, title: true, status: true, otFileUrl: true } },
    },
  })
}

export async function listBranches(actor: Actor, clientId: string) {
  return prisma.branch.findMany({
    where: { ...tenantScope(actor), clientId },
    orderBy: { name: 'asc' },
  })
}

export async function getClientSummaries(actor: Actor, from?: Date, to?: Date) {
  return prisma.job.findMany({
    where: {
      ...tenantScope(actor),
      ...(from || to
        ? { executionDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
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

export async function getMonthlySummary(actor: Actor, months = 12, fromOverride?: Date, to?: Date) {
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
      ...(from || to
        ? { executionDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
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
