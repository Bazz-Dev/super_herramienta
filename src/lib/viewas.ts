import { cookies } from 'next/headers'
import { prisma } from './prisma'
import type { Role } from '@/generated/prisma/enums'
import type { AuthActor } from './tenant'

/** Substitutes actor data with the viewas target if super has an active cookie. */
export async function applyViewAs(
  actor: AuthActor,
): Promise<AuthActor & { viewingAsName?: string }> {
  if (actor.role !== 'super') return actor
  const store = await cookies()
  const userId = store.get('viewas')?.value
  if (!userId) return actor
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true, tenantId: true, technicianId: true },
  })
  if (!user || !user.tenantId) return actor
  return {
    ...actor,
    role: user.role as Role,
    tenantId: user.tenantId,
    // technicianId del objetivo: mi-panel y filtros por técnico reflejan al suplantado
    technicianId: user.technicianId ?? null,
    // effectiveId SÍ se sustituye (a diferencia de `id`) — necesario para que
    // los filtros de "dueño del ticket" (Ticket.assignedToId) encuentren los
    // tickets del suplantado, no los del admin real.
    effectiveId: userId,
    viewingAsName: user.name ?? userId,
  }
}

/** Returns the viewas target's display name, or null when not active. Super only. */
export async function getViewAsName(callerRole: Role): Promise<string | null> {
  if (callerRole !== 'super') return null
  const store = await cookies()
  const userId = store.get('viewas')?.value
  if (!userId) return null
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
  return user?.name ?? null
}
