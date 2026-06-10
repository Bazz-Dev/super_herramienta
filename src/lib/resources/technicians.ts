import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

// Read queries for technicians, scoped to the actor's tenant (super sees all).
export async function listTechnicians(actor: TenantActor, search?: string) {
  const q = search?.trim()
  return prisma.technician.findMany({
    where: {
      ...tenantScope(actor),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { specialty: { contains: q } },
              { rut: { contains: q } },
            ],
          }
        : {}),
    },
    include: { tenant: { select: { slug: true } }, _count: { select: { crews: true } } },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })
}

export async function getTechnician(actor: TenantActor, id: string) {
  const tech = await prisma.technician.findFirst({
    where: { id, ...tenantScope(actor) },
  })
  return tech
}

export type TechnicianListItem = Awaited<ReturnType<typeof listTechnicians>>[number]
