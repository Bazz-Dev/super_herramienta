'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { assertRole } from '@/lib/policies'
import { notify } from '@/lib/push'
import { driveEnabled, createDriveFolder, ticketFolderName } from '@/lib/drive'

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
  showToClient: z.boolean().optional(),
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

  // Fetch client for Drive folder creation
  const clientRecord = await prisma.client.findUnique({
    where: { id: parsed.clientId },
    select: { name: true, driveFolderId: true },
  })
  const branchRecord = parsed.branchId
    ? await prisma.branch.findUnique({ where: { id: parsed.branchId }, select: { name: true } })
    : null

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

  // Auto-create Drive folder if client has a root folder configured
  if (driveEnabled() && clientRecord?.driveFolderId) {
    const folderName = ticketFolderName({
      ticketCode: ticket.ticketCode,
      clientName: clientRecord.name,
      branchName: branchRecord?.name,
    })
    createDriveFolder(folderName, clientRecord.driveFolderId)
      .then((folder) =>
        prisma.ticket.update({
          where: { id: ticket.id },
          data: { driveFolderUrl: folder.webViewLink },
        }),
      )
      .catch((err) => console.error('[Drive] folder creation failed:', err))
  }

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

  // Notify assigned user if staff assigned on creation
  if (assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, tenantId: true } })
    if (assignee) {
      notify(assignee.id, assignee.tenantId, {
        type: 'ticket_assigned',
        title: `Ticket asignado: ${ticket.ticketCode}`,
        body: ticket.title,
        href: `/tickets/${ticket.id}`,
      }).catch(() => {})
    }
  }

  revalidatePath('/tickets')
  return { success: true, id: ticket.id }
}

export async function updateTicketStatus(ticketId: string, newStatus: string, note?: string) {
  const actor = await requireActor()

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId },
    select: { id: true, status: true, title: true, ticketCode: true, createdById: true, showToClient: true, client: { select: { portalSlug: true } } },
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

  // Notify client if ticket is visible to them
  const STATUS_ES: Record<string, string> = {
    en_revision: 'En revisión', en_ejecucion: 'En ejecución',
    resuelto: 'Resuelto ✅', cancelado: 'Cancelado',
  }
  if (ticket.showToClient && ticket.createdById && STATUS_ES[newStatus]) {
    const creator = await prisma.user.findUnique({
      where: { id: ticket.createdById },
      select: { id: true, role: true, tenantId: true },
    })
    if (creator?.role === 'client') {
      const portalSlug = ticket.client?.portalSlug
      const href = portalSlug
        ? `/portal/${portalSlug}/tickets/${ticketId}`
        : `/portal/tickets`
      notify(creator.id, creator.tenantId, {
        type: 'ticket_update',
        title: `Solicitud ${ticket.ticketCode} actualizada`,
        body: `${STATUS_ES[newStatus]}: ${ticket.title}`,
        href,
      }).catch(() => {})
    }
  }

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
  const assigneeChanged = parsed.assignedToId !== undefined && parsed.assignedToId !== ticket.assignedToId
  if (parsed.assignedToId && assigneeChanged && ticket.status === 'nuevo') {
    autoStatus = 'en_revision'
  }

  const updatedTicket = await prisma.ticket.findFirst({ where: { id: ticketId }, select: { ticketCode: true, title: true } })

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

  // Notify newly assigned user
  if (parsed.assignedToId && assigneeChanged) {
    const assignee = await prisma.user.findUnique({ where: { id: parsed.assignedToId }, select: { id: true, tenantId: true } })
    if (assignee && updatedTicket) {
      notify(assignee.id, assignee.tenantId, {
        type: 'ticket_assigned',
        title: `Ticket asignado: ${updatedTicket.ticketCode}`,
        body: updatedTicket.title,
        href: `/tickets/${ticketId}`,
      }).catch(() => {})
    }
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
  assertRole(actor, ['super', 'supervisor'])
  await prisma.ticket.updateMany({
    where: { id: ticketId, tenantId: actor.tenantId },
    data: { deletedAt: new Date() },
  })
  revalidatePath('/tickets')
  return { success: true }
}
