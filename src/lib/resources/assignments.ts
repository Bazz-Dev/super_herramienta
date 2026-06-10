import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

const withRefs = {
  tenant: { select: { slug: true } },
  technician: { select: { id: true, name: true } },
  crew: { select: { id: true, name: true } },
  asset: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
} as const

export async function listAssignments(actor: TenantActor) {
  return prisma.assignment.findMany({
    where: { ...tenantScope(actor) },
    include: withRefs,
    orderBy: [{ start: 'asc' }],
  })
}

export async function getAssignment(actor: TenantActor, id: string) {
  return prisma.assignment.findFirst({ where: { id, ...tenantScope(actor) } })
}

// Options for the assignment form selects.
export async function assignmentOptions(actor: TenantActor) {
  const [technicians, crews, assets, clients] = await Promise.all([
    prisma.technician.findMany({ where: { ...tenantScope(actor), active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.crew.findMany({ where: { ...tenantScope(actor), active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.asset.findMany({ where: { ...tenantScope(actor) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.client.findMany({ where: { ...tenantScope(actor) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  return { technicians, crews, assets, clients }
}

export type AssignmentListItem = Awaited<ReturnType<typeof listAssignments>>[number]
export type AssignmentOptions = Awaited<ReturnType<typeof assignmentOptions>>
