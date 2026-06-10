import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

export async function listCrews(actor: TenantActor) {
  return prisma.crew.findMany({
    where: { ...tenantScope(actor) },
    include: {
      tenant: { select: { slug: true } },
      technicians: { select: { id: true, name: true } },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })
}

export async function getCrew(actor: TenantActor, id: string) {
  return prisma.crew.findFirst({
    where: { id, ...tenantScope(actor) },
    include: { technicians: { select: { id: true } } },
  })
}

// Lightweight technician options for crew/assignment selects.
export async function technicianOptions(actor: TenantActor) {
  return prisma.technician.findMany({
    where: { ...tenantScope(actor), active: true },
    select: { id: true, name: true, specialty: true, vehiclePlate: true },
    orderBy: { name: 'asc' },
  })
}

export type CrewListItem = Awaited<ReturnType<typeof listCrews>>[number]
