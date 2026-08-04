'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { notifyTenantStaff } from '@/lib/push'
import { TECNICO_TRANSITIONS } from '@/lib/tickets/labels'
import { isProposalApproved, canStartExecution } from '@/lib/tickets/ticket-state-summary'
import type { TicketStatus } from '@/generated/prisma/enums'

// G23 — acciones del técnico sobre SUS tickets. Toda verificación es server-side:
// rol tecnico + ticket asignado a él + transición permitida.

async function ownedTicket(ticketId: string) {
  const actor = await requireActor(['tecnico'])
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId, assignedToId: actor.effectiveId, deletedAt: null },
    select: { id: true, status: true, ticketCode: true, title: true, processFlow: true },
  })
  return { actor, ticket }
}

export async function tecnicoAdvanceStatus(ticketId: string, newStatus: string) {
  const { actor, ticket } = await ownedTicket(ticketId)
  if (!ticket) return { success: false, error: 'Ticket no asignado a ti.' }

  const allowed = TECNICO_TRANSITIONS[ticket.status] ?? []
  if (!allowed.includes(newStatus as never)) {
    return { success: false, error: `Transición ${ticket.status} → ${newStatus} no permitida.` }
  }

  // Gate PP (informe #2): mismo límite que updateTicketStatus del lado staff
  // — modalidad Presupuesto previo no arranca ejecución sin propuesta aprobada.
  if (newStatus === 'en_ejecucion') {
    const [job, propuesta] = await Promise.all([
      prisma.job.findFirst({
        where: { originTicketId: ticketId, tenantId: actor.tenantId },
        orderBy: { createdAt: 'desc' },
        select: { commercialStage: true },
      }),
      prisma.clientDocument.findFirst({
        where: { tenantId: actor.tenantId, type: 'propuesta', ticketId },
        orderBy: { createdAt: 'desc' },
        select: { proposalStatus: true },
      }),
    ])
    if (!canStartExecution(ticket.processFlow, isProposalApproved(job, propuesta))) {
      return { success: false, error: 'Este ticket requiere una propuesta aprobada antes de iniciar ejecución (modalidad Presupuesto previo).' }
    }
  }

  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: newStatus as TicketStatus } })
  await prisma.ticketHistory.create({
    data: { ticketId, userId: actor.id, fromStatus: ticket.status, toStatus: newStatus, isInternal: false },
  })
  // Notificación tolerante a fallos: nunca bloquea la operación principal
  notifyTenantStaff(actor.tenantId, {
    type: 'ticket_update',
    title: `Avance técnico en ${ticket.ticketCode}`,
    body: `${actor.name}: ${ticket.status} → ${newStatus}`,
    href: `/tickets/${ticketId}`,
  }).catch(() => {})

  revalidatePath('/mi-panel/tickets')
  revalidatePath(`/mi-panel/tickets/${ticketId}`)
  revalidatePath(`/tickets/${ticketId}`)
  return { success: true }
}

export async function tecnicoAddComment(ticketId: string, note: string, isInternal: boolean) {
  const { actor, ticket } = await ownedTicket(ticketId)
  if (!ticket) return { success: false, error: 'Ticket no asignado a ti.' }
  const trimmed = note.trim()
  if (!trimmed) return { success: false, error: 'Comentario vacío.' }

  await prisma.ticketHistory.create({
    data: { ticketId, userId: actor.id, note: trimmed, isInternal },
  })
  revalidatePath(`/mi-panel/tickets/${ticketId}`)
  revalidatePath(`/tickets/${ticketId}`)
  return { success: true }
}
