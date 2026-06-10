import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { TenantActor } from '@/lib/tenant'

// Resolve the current authenticated actor (role + tenant) for resource scoping.
export async function requireActor(): Promise<TenantActor & { name: string; tenantSlug: string }> {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const u = session.user
  return { role: u.role, tenantId: u.tenantId, tenantSlug: u.tenantSlug, name: u.name ?? 'Usuario' }
}
