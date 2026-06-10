import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

export async function listClients(actor: TenantActor, search?: string) {
  const q = search?.trim()
  return prisma.client.findMany({
    where: {
      ...tenantScope(actor),
      ...(q ? { OR: [{ name: { contains: q } }, { rut: { contains: q } }, { contact: { contains: q } }] } : {}),
    },
    include: {
      tenant: { select: { slug: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ name: 'asc' }],
  })
}

export async function getClient(actor: TenantActor, id: string) {
  return prisma.client.findFirst({ where: { id, ...tenantScope(actor) } })
}

export type ClientListItem = Awaited<ReturnType<typeof listClients>>[number]
