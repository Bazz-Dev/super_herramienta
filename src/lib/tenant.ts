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
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export type TenantActor = {
  id: string
  role: Role
  tenantId: string
  technicianId?: string | null
}

export type AuthActor = TenantActor & {
  name: string
  tenantSlug: string
}

// Minimal type required by tenantScope / canAccessTenant — callers that only
// have { role, tenantId } (e.g. API routes) can use this without building a
// full TenantActor. TenantActor and AuthActor both satisfy it structurally.
export type ScopeActor = Pick<TenantActor, 'role' | 'tenantId'>

export async function requireActor(allowedRoles?: Role[]): Promise<AuthActor> {
  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')
  const u = session.user
  if (allowedRoles && !allowedRoles.includes(u.role as Role)) redirect('/dashboard')
  return {
    id: u.id,
    role: u.role,
    tenantId: u.tenantId,
    tenantSlug: u.tenantSlug,
    name: u.name ?? 'Usuario',
    technicianId: u.technicianId ?? null,
  }
}

export function tenantScope(actor: ScopeActor): { tenantId?: string } {
  if (actor.role === 'super') return {}
  return { tenantId: actor.tenantId }
}

export function canAccessTenant(actor: ScopeActor, tenantId: string): boolean {
  return actor.role === 'super' || actor.tenantId === tenantId
}
