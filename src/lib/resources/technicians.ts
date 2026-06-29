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
    include: {
      tenant: { select: { slug: true } },
      _count: { select: { crews: true } },
      vehicle: { select: { id: true, plate: true, _count: { select: { assets: true } } } },
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })
}

export async function getTechnician(actor: TenantActor, id: string) {
  return prisma.technician.findFirst({
    where: { id, ...tenantScope(actor) },
    include: {
      vehicle: {
        include: {
          assets: { select: { id: true, name: true, code: true, status: true }, orderBy: { name: 'asc' } },
        },
      },
      documents: { orderBy: { uploadedAt: 'desc' } },
    },
  })
}

export type TechnicianListItem = Awaited<ReturnType<typeof listTechnicians>>[number]
export type TechnicianDetail = NonNullable<Awaited<ReturnType<typeof getTechnician>>>
