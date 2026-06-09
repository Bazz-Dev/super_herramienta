import type { Role } from '@/generated/prisma/enums'

/**
 * Multi-tenant scoping helper.
 *
 * Rule (per project brief): the INGEGAR "super" role sees every tenant's data;
 * everyone else is restricted to their own tenant.
 *
 * Use the returned object as a spread into a Prisma `where` clause:
 *
 *   await prisma.someResource.findMany({ where: { ...tenantScope(session) } })
 */
export type TenantActor = {
  role: Role
  tenantId: string
}

export function tenantScope(actor: TenantActor): { tenantId?: string } {
  if (actor.role === 'super') return {}
  return { tenantId: actor.tenantId }
}

export function canAccessTenant(actor: TenantActor, tenantId: string): boolean {
  return actor.role === 'super' || actor.tenantId === tenantId
}
