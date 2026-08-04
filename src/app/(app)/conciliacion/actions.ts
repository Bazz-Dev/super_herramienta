'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'

// Triage del backlog "modelo anterior" (informe #4/#9) — 328 trabajos reales
// sin ticket de origen a la fecha de esta sesión. Nunca se vincula ni se
// marca legado automáticamente: cada acción acá es una decisión humana
// explícita, una fila (o una selección explícita) a la vez.

export async function linkJobToExistingTicket(jobId: string, ticketId: string): Promise<{ error?: string }> {
  const actor = await requireActor(['super', 'supervisor'])

  const [job, ticket] = await Promise.all([
    prisma.job.findFirst({ where: { id: jobId, tenantId: actor.tenantId, originTicketId: null }, select: { clientId: true } }),
    prisma.ticket.findFirst({ where: { id: ticketId, tenantId: actor.tenantId }, select: { clientId: true } }),
  ])
  if (!job) return { error: 'Trabajo no encontrado o ya tiene ticket.' }
  if (!ticket) return { error: 'Ticket no encontrado.' }
  // Vincular a un ticket de otro cliente sería un error de datos real, no una
  // decisión legítima — se bloquea en vez de confiar en que quien elige el
  // ticket del dropdown (ya filtrado por cliente) no se equivoque.
  if (ticket.clientId !== job.clientId) return { error: 'El ticket elegido pertenece a otro cliente.' }

  await prisma.job.update({ where: { id: jobId }, data: { originTicketId: ticketId, legacyNoTicket: false } })
  revalidatePath('/conciliacion')
  return {}
}

export async function markJobsLegacy(jobIds: string[]): Promise<{ error?: string }> {
  const actor = await requireActor(['super', 'supervisor'])
  if (jobIds.length === 0) return { error: 'Selecciona al menos un trabajo.' }

  await prisma.job.updateMany({
    where: { id: { in: jobIds }, tenantId: actor.tenantId, originTicketId: null },
    data: { legacyNoTicket: true, legacyReviewedById: actor.id, legacyReviewedAt: new Date() },
  })
  revalidatePath('/conciliacion')
  return {}
}

export async function unmarkJobLegacy(jobId: string): Promise<{ error?: string }> {
  const actor = await requireActor(['super', 'supervisor'])
  await prisma.job.updateMany({
    where: { id: jobId, tenantId: actor.tenantId },
    data: { legacyNoTicket: false, legacyReviewedById: actor.id, legacyReviewedAt: new Date() },
  })
  revalidatePath('/conciliacion')
  return {}
}
