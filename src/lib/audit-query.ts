import type { ScopeActor } from '@/lib/tenant'
import { tenantScope } from '@/lib/tenant'

// Extraído de /recursos/auditoria para poder testear el aislamiento por
// tenant sin renderizar la página (G49.1) — misma lógica, función pura.
export function auditLogWhere(
  actor: ScopeActor,
  filters: { desde?: string; hasta?: string; actor?: string; entityType?: string; entityId?: string; action?: string; source?: string },
) {
  const { desde, hasta, actor: actorQuery, entityType, entityId, action, source } = filters
  return {
    ...tenantScope(actor),
    ...(desde || hasta ? {
      createdAt: {
        ...(desde ? { gte: new Date(`${desde}T00:00:00.000Z`) } : {}),
        ...(hasta ? { lte: new Date(`${hasta}T23:59:59.999Z`) } : {}),
      },
    } : {}),
    ...(actorQuery ? { actor: { name: { contains: actorQuery } } } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(action ? { action: { contains: action } } : {}),
    ...(source ? { source: { contains: source } } : {}),
  }
}
