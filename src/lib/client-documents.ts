import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

export async function listClientDocuments(actor: TenantActor, clientId: string) {
  return prisma.clientDocument.findMany({
    where: { ...tenantScope(actor), clientId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { name: true } } },
  })
}

export async function listAllClientDocuments(actor: TenantActor) {
  return prisma.clientDocument.findMany({
    where: { ...tenantScope(actor) },
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  })
}

export async function deleteClientDocument(actor: TenantActor, id: string) {
  const doc = await prisma.clientDocument.findFirst({
    where: { id, ...tenantScope(actor) },
    select: { fileKey: true },
  })
  if (!doc) return null
  await prisma.clientDocument.delete({ where: { id } })
  return doc.fileKey
}

export type ClientDocumentWithClient = Awaited<ReturnType<typeof listAllClientDocuments>>[number]
export type ClientDocumentItem = Awaited<ReturnType<typeof listClientDocuments>>[number]
