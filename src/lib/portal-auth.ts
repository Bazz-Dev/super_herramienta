import type { Session } from 'next-auth'

/**
 * Returns whether the current session can access a given client portal.
 *
 * - `client` role: must own the clientId (Carolina accessing JB portal)
 * - `super` / `supervisor`: always allowed — staff previewing the portal as-is
 */
export function canViewPortal(session: Session | null, clientId: string): boolean {
  if (!session?.user) return false
  const { role, clientId: userClientId } = session.user
  if (role === 'super' || role === 'supervisor') return true
  return role === 'client' && userClientId === clientId
}

/** True when the viewer is staff (not the client themselves) */
export function isStaffViewing(session: Session | null): boolean {
  if (!session?.user) return false
  return session.user.role === 'super' || session.user.role === 'supervisor'
}
