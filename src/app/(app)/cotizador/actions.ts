'use server'

import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { logAudit } from '@/lib/audit'

// Lee el estado actual del correlativo para el panel de administración
// (super-only) — ver Modal en quote-sequence-config-modal.tsx. Devuelve
// null si el tenant nunca asignó un número todavía (assignQuoteNumber lo
// crea perezosamente en 1 la primera vez que se necesita de verdad).
export async function getQuoteSequenceConfig() {
  const actor = await requireActor(['super'])
  const config = await prisma.quoteSequenceConfig.findUnique({
    where: { tenantId: actor.tenantId },
    select: { nextNumber: true, updatedAt: true, updatedBy: { select: { name: true } } },
  })
  if (!config) return null
  return { nextNumber: config.nextNumber, updatedAt: config.updatedAt, updatedByName: config.updatedBy?.name ?? null }
}

// Solo puede avanzar (pedido explícito): nunca se acepta un nextNumber
// menor o igual al ya configurado. No compara contra "el número más alto
// ya usado" — el contador real (quote_sequence_config.nextNumber) YA es
// ese máximo+1 en todo momento, comparar contra sí mismo alcanza.
export async function updateQuoteSequenceConfig(nextNumber: number): Promise<{ success: true } | { success: false; error: string }> {
  const actor = await requireActor(['super'])
  if (!Number.isInteger(nextNumber) || nextNumber < 1) {
    return { success: false, error: 'El número debe ser un entero positivo.' }
  }

  const existing = await prisma.quoteSequenceConfig.findUnique({ where: { tenantId: actor.tenantId }, select: { nextNumber: true } })
  if (existing && nextNumber <= existing.nextNumber) {
    return { success: false, error: 'No es posible retroceder el correlativo. El nuevo número debe ser mayor al último número de presupuesto utilizado.' }
  }

  const before = existing?.nextNumber ?? null
  await prisma.quoteSequenceConfig.upsert({
    where: { tenantId: actor.tenantId },
    create: { tenantId: actor.tenantId, nextNumber, updatedById: actor.id },
    update: { nextNumber, updatedById: actor.id },
  })
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'quote_sequence_config.update', entityType: 'QuoteSequenceConfig', entityId: actor.tenantId,
    before: { nextNumber: before }, after: { nextNumber },
    source: 'cotizador/actions.ts:updateQuoteSequenceConfig',
  })
  return { success: true }
}
