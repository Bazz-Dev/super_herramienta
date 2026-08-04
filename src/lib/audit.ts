import { prisma } from '@/lib/prisma'

// Auditoría transversal (informe #32B) — SOLO para acciones sensibles con
// impacto real, nunca navegación/lecturas. before/after son objetos que el
// CALLER arma explícitamente con solo los campos que cambiaron — nunca pasar
// una fila completa de Prisma (así nunca se cuela un passwordHash/ciphertext
// por accidente). Bloqueo duro: si un campo sospechoso llega igual, esto
// FALLA (no lo redacta en silencio) — un fallo ruidoso durante desarrollo es
// preferible a un log silenciosamente incompleto que nadie nota.
const SENSITIVE_KEY = /password|hash|token|secret|ciphertext|signedurl|apikey/i

function sanitize(obj: Record<string, unknown> | undefined, label: 'before' | 'after'): string | null {
  if (!obj) return null
  const bad = Object.keys(obj).find((k) => SENSITIVE_KEY.test(k))
  if (bad) throw new Error(`logAudit: campo sospechoso "${bad}" en "${label}" — no se audita, revisa el call site.`)
  return JSON.stringify(obj)
}

export async function logAudit(params: {
  tenantId: string
  actorId?: string | null
  actorRole: string
  action: string
  entityType: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  reason?: string
  source: string
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      actorId: params.actorId ?? null,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      before: sanitize(params.before, 'before'),
      after: sanitize(params.after, 'after'),
      reason: params.reason ?? null,
      source: params.source,
    },
  })
}
