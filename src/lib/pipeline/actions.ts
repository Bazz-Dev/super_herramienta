'use server'

import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import type { ProposalStatus } from '@/generated/prisma/enums'

async function getActor() {
  return requireActor(['super', 'supervisor'])
}

export async function addToPipeline(docId: string) {
  const actor = await getActor()
  const doc = await prisma.clientDocument.findFirst({
    where: { id: docId, tenantId: actor.tenantId ?? undefined, type: 'propuesta' },
    select: { id: true, metadata: true },
  })
  if (!doc) return { success: false }

  // Extract amount from metadata if available
  let proposalAmount: number | undefined
  if (doc.metadata) {
    try {
      const meta = JSON.parse(doc.metadata) as { amount?: number }
      if (meta.amount) proposalAmount = Math.round(meta.amount)
    } catch { /* ignore */ }
  }

  await prisma.clientDocument.update({
    where: { id: docId },
    data: { proposalStatus: 'borrador', proposalAmount: proposalAmount ?? null },
  })
  return { success: true }
}

export async function updatePipelineStatus(
  docId: string,
  status: ProposalStatus,
  note?: string,
) {
  const actor = await getActor()
  const doc = await prisma.clientDocument.findFirst({
    where: { id: docId, tenantId: actor.tenantId ?? undefined, type: 'propuesta' },
    select: { id: true, proposalStatus: true },
  })
  if (!doc) return { success: false }

  const now = new Date()
  const dateFields: Record<string, Date | null> = {}
  if (status === 'enviada' && doc.proposalStatus !== 'enviada') dateFields.sentAt = now
  if (status === 'vista'    && doc.proposalStatus !== 'vista')   dateFields.viewedAt = now
  if (['aceptada', 'rechazada', 'perdida'].includes(status))      dateFields.responseAt = now

  await prisma.clientDocument.update({
    where: { id: docId },
    data: {
      proposalStatus: status,
      ...dateFields,
      ...(note !== undefined ? { proposalNote: note } : {}),
    },
  })
  return { success: true }
}

export async function updatePipelineAmount(docId: string, amount: number | null) {
  const actor = await getActor()
  const doc = await prisma.clientDocument.findFirst({
    where: { id: docId, tenantId: actor.tenantId ?? undefined },
    select: { id: true },
  })
  if (!doc) return { success: false }
  await prisma.clientDocument.update({ where: { id: docId }, data: { proposalAmount: amount } })
  return { success: true }
}

export async function updateFollowUp(docId: string, followUpAt: Date | null) {
  const actor = await getActor()
  const doc = await prisma.clientDocument.findFirst({
    where: { id: docId, tenantId: actor.tenantId ?? undefined },
    select: { id: true },
  })
  if (!doc) return { success: false }
  await prisma.clientDocument.update({ where: { id: docId }, data: { followUpAt } })
  return { success: true }
}

export async function removeFromPipeline(docId: string) {
  const actor = await getActor()
  const doc = await prisma.clientDocument.findFirst({
    where: { id: docId, tenantId: actor.tenantId ?? undefined },
    select: { id: true },
  })
  if (!doc) return { success: false }
  await prisma.clientDocument.update({
    where: { id: docId },
    data: {
      proposalStatus: null,
      proposalAmount: null,
      sentAt: null,
      viewedAt: null,
      responseAt: null,
      followUpAt: null,
      proposalNote: null,
    },
  })
  return { success: true }
}
