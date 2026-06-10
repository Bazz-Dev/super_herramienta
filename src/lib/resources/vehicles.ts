import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

export async function listVehicles(actor: TenantActor, search?: string) {
  const q = search?.trim()
  return prisma.vehicle.findMany({
    where: {
      ...tenantScope(actor),
      ...(q ? { OR: [{ plate: { contains: q } }, { brand: { contains: q } }, { model: { contains: q } }] } : {}),
    },
    include: {
      tenant: { select: { slug: true } },
      technician: { select: { id: true, name: true } },
      _count: { select: { assets: true } },
    },
    orderBy: [{ plate: 'asc' }],
  })
}

export async function getVehicle(actor: TenantActor, id: string) {
  return prisma.vehicle.findFirst({
    where: { id, ...tenantScope(actor) },
    include: {
      technician: { select: { id: true, name: true } },
      assets: { select: { id: true, name: true, code: true, status: true }, orderBy: { name: 'asc' } },
    },
  })
}

// Vehicle options for the asset form (assign a tool to a truck).
export async function vehicleOptions(actor: TenantActor) {
  return prisma.vehicle.findMany({
    where: { ...tenantScope(actor) },
    select: { id: true, plate: true, technician: { select: { name: true } } },
    orderBy: { plate: 'asc' },
  })
}

// Active technicians for the vehicle 1:1 assignment select, flagged if already
// assigned to another truck so the form can warn about reassignment.
export async function technicianOptionsForVehicle(actor: TenantActor) {
  return prisma.technician.findMany({
    where: { ...tenantScope(actor), active: true },
    select: { id: true, name: true, vehicle: { select: { id: true, plate: true } } },
    orderBy: { name: 'asc' },
  })
}

export type VehicleListItem = Awaited<ReturnType<typeof listVehicles>>[number]
