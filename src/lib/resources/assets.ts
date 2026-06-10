import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

export async function listAssets(actor: TenantActor, search?: string) {
  const q = search?.trim()
  return prisma.asset.findMany({
    where: {
      ...tenantScope(actor),
      ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }, { category: { contains: q } }] } : {}),
    },
    include: {
      tenant: { select: { slug: true } },
      holder: { select: { id: true, name: true, vehiclePlate: true } },
    },
    orderBy: [{ name: 'asc' }],
  })
}

export async function getAsset(actor: TenantActor, id: string) {
  return prisma.asset.findFirst({ where: { id, ...tenantScope(actor) } })
}

export type AssetListItem = Awaited<ReturnType<typeof listAssets>>[number]
