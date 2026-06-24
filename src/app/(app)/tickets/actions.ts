'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'

const createSchema = z.object({
  ticketCode: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  urgency: z.enum(['emergencia', 'urgencia', 'no_urgente', 'preventivo']).default('no_urgente'),
  category: z.string().optional(),
  clientId: z.string().min(1),
  branchId: z.string().optional(),
  assignedToId: z.string().optional(),
  internalNotes: z.string().optional(),
})

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  urgency: z.enum(['emergencia', 'urgencia', 'no_urgente', 'preventivo']).optional(),
  category: z.string().optional(),
  status: z.enum(['nuevo','en_revision','en_ejecucion','esperando_aprobacion','resuelto','cancelado','fusionado']).optional(),
  otNumber: z.string().optional(),
  estimatedDate: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  workSummary: z.string().optional(),
  clientComment: z.string().optional(),
  internalNotes: z.string().optional(),
  driveFolderUrl: z.string().optional(),
  branchId: z.string().nullable().optional(),
})

export async function createTicket(_: unknown, fd: FormData) {
  const actor = await requireActor()
  const parsed = createSchema.parse({
    ticketCode: fd.get('ticketCode'),
    title: fd.get('title'),
    description: fd.get('description') || undefined,
    urgency: fd.get('urgency') || 'no_urgente',
    category: fd.get('category') || undefined,
    clientId: fd.get('clientId'),
    branchId: fd.get('branchId') || undefined,
    assignedToId: fd.get('assignedToId') || undefined,
    internalNotes: fd.get('internalNotes') || undefined,
  })

  const { assignedToId, internalNotes, ...ticketData } = parsed
  const initialStatus = assignedToId ? 'en_revision' : 'nuevo'

  const ticket = await prisma.ticket.create({
    data: {
      ...ticketData,
      assignedToId: assignedToId ?? null,
      internalNotes: internalNotes ?? null,
      tenantId: actor.tenantId,
      createdById: actor.id,
      status: initialStatus,
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      userId: actor.id,
      fromStatus: null,
      toStatus: initialStatus,
      note: assignedToId ? 'Ticket creado y asignado' : 'Ticket creado',
      isInternal: false,
    },
  })

  revalidatePath('/tickets')
  return { success: true, id: ticket.id }
}

export async function updateTicketStatus(ticketId: string, newStatus: string, note?: string) {
  const actor = await requireActor()

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId },
    select: { id: true, status: true },
  })
  if (!ticket) return { success: false }

  const closedDate = ['resuelto', 'cancelado'].includes(newStatus) ? new Date() : undefined

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: newStatus as never,
      ...(closedDate ? { closedDate } : {}),
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: actor.id,
      fromStatus: ticket.status,
      toStatus: newStatus,
      note: note ?? null,
      isInternal: false,
    },
  })

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return { success: true }
}

export async function updateTicketFields(ticketId: string, data: z.infer<typeof updateSchema>, internalNote?: string) {
  const actor = await requireActor()

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId },
    select: { id: true, status: true, assignedToId: true },
  })
  if (!ticket) return { success: false }

  const parsed = updateSchema.parse(data)

  // Auto-advance status: assigning technician → en_revision
  let autoStatus: string | undefined
  if (parsed.assignedToId && parsed.assignedToId !== ticket.assignedToId && ticket.status === 'nuevo') {
    autoStatus = 'en_revision'
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...parsed,
      estimatedDate: parsed.estimatedDate ? new Date(parsed.estimatedDate) : undefined,
      ...(autoStatus ? { status: autoStatus as never } : {}),
    },
  })

  if (autoStatus) {
    await prisma.ticketHistory.create({
      data: {
        ticketId,
        userId: actor.id,
        fromStatus: ticket.status,
        toStatus: autoStatus,
        note: 'Técnico asignado',
        isInternal: true,
      },
    })
  }

  if (internalNote) {
    await prisma.ticketHistory.create({
      data: { ticketId, userId: actor.id, note: internalNote, isInternal: true },
    })
  }

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return { success: true }
}

export async function addTicketComment(ticketId: string, note: string, isInternal: boolean) {
  const actor = await requireActor()

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId },
    select: { id: true },
  })
  if (!ticket) return { success: false }

  await prisma.ticketHistory.create({
    data: { ticketId, userId: actor.id, note, isInternal },
  })

  revalidatePath(`/tickets/${ticketId}`)
  return { success: true }
}

export async function deleteTicket(ticketId: string) {
  const actor = await requireActor()
  await prisma.ticket.deleteMany({ where: { id: ticketId, tenantId: actor.tenantId } })
  revalidatePath('/tickets')
  return { success: true }
}
