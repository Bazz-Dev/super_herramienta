'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { notifyTenantStaff, sendPushToUser } from '@/lib/push'
import { ticketFolderKey } from '@/lib/r2'
import type { TicketUrgency } from '@/generated/prisma/enums'

function buildTicketCode(urgency: string, branchName: string, clientPrefix: string): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const urgMap: Record<string, string> = { emergencia: 'EM', urgencia: 'UR', no_urgente: 'RQ', preventivo: 'PR' }
  const code = urgMap[urgency] ?? 'RQ'
  const suc    = branchName.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  const prefix = clientPrefix.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
  return `${yy}${mm}${dd}-${prefix}-${code}1-${suc}`
}

export async function createPortalTicket(fd: FormData) {
  const session = await auth()
  const role = session?.user?.role
  const isStaff = role === 'super' || role === 'supervisor'
  const isClient = role === 'client'
  const isClientAdmin = session?.user?.isClientAdmin ?? false
  if (!session?.user || (!isStaff && !isClient)) return { success: false }

  const clientId      = String(fd.get('clientId') ?? '')
  const createdById   = String(fd.get('createdById') ?? session.user.id)
  const branchId      = String(fd.get('branchId') ?? '') || (session.user.branchId ?? undefined)
  const urgency       = String(fd.get('urgency') ?? 'no_urgente')
  const category      = String(fd.get('category') ?? '') || undefined
  const title         = String(fd.get('title') ?? '').trim()
  const description   = String(fd.get('description') ?? '') || undefined
  const clientComment = String(fd.get('clientComment') ?? '') || undefined

  if (!title || !clientId) return { success: false }

  // Client: must match their own clientId
  if (isClient && session.user.clientId !== clientId) return { success: false }

  const [branch, client] = await Promise.all([
    branchId ? prisma.branch.findUnique({ where: { id: branchId, clientId }, select: { name: true } }) : Promise.resolve(null),
    prisma.client.findUnique({ where: { id: clientId }, select: { tenantId: true, portalSlug: true, name: true } }),
  ])
  if (!client) return { success: false }

  // Staff: can only create for clients belonging to their tenant
  if (isStaff && client.tenantId !== session.user.tenantId) return { success: false }

  const clientPrefix = client.portalSlug ?? client.name.split(' ')[0]
  const ticketCode = buildTicketCode(urgency, branch?.name ?? 'SUCURSAL', clientPrefix)

  const existing = await prisma.ticket.findUnique({ where: { ticketCode }, select: { id: true } })
  const finalCode = existing ? `${ticketCode}-${Date.now().toString(36).slice(-4)}` : ticketCode

  // Branch users (non-admin clients) → pendiente_aprobacion for Carolina to review
  const isBranchUser = isClient && !isClientAdmin
  const ticketStatus = isBranchUser ? 'pendiente_aprobacion' : 'nuevo'

  const uploadedFiles = JSON.parse(String(fd.get('uploadedFiles') ?? '[]')) as {
    key: string; name: string; mimeType: string
  }[]

  const ticket = await prisma.ticket.create({
    data: {
      ticketCode: finalCode,
      title,
      description,
      clientComment,
      urgency: urgency as TicketUrgency,
      category,
      status: ticketStatus,
      clientId,
      branchId,
      tenantId: client.tenantId,
      createdById,
      folderKey: ticketFolderKey(client.portalSlug ?? clientPrefix, finalCode),
    },
  })

  if (uploadedFiles.length > 0) {
    await prisma.ticketDocument.createMany({
      data: uploadedFiles.map(f => ({
        ticketId: ticket.id,
        uploadedById: createdById,
        name: f.name,
        fileUrl: f.key,
        mimeType: f.mimeType,
      })),
    })
  }

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      userId: createdById,
      toStatus: ticketStatus,
      note: isStaff
        ? `Solicitud registrada por INGEGAR en nombre de ${client.name}`
        : isBranchUser
          ? 'Solicitud creada por sucursal — pendiente aprobación del cliente administrador'
          : 'Solicitud creada por cliente',
      isInternal: false,
    },
  })

  const urgencyLabel: Record<string, string> = { emergencia: '🚨 EMERGENCIA', urgencia: '⚠️ Urgente', no_urgente: 'Normal', preventivo: 'Preventivo' }

  if (isBranchUser) {
    // Notify the client admin (Carolina) to approve or reject
    const clientAdmin = await prisma.user.findFirst({
      where: { clientId, isClientAdmin: true, active: true },
      select: { id: true },
    })
    if (clientAdmin) {
      await sendPushToUser(clientAdmin.id, {
        title: `Nueva solicitud de ${branch?.name ?? 'sucursal'} — revisar`,
        body: `${urgencyLabel[urgency] ?? urgency}: ${title}`,
        href: `/portal/${client.portalSlug ?? 'portal'}/tickets/${ticket.id}`,
      }).catch(() => {})
    }
  } else {
    await notifyTenantStaff(client.tenantId, {
      type: 'ticket_new',
      title: `Nuevo ticket — ${client.name}`,
      body: `${urgencyLabel[urgency] ?? urgency}: ${title}${branch ? ` · ${branch.name}` : ''}`,
      href: `/tickets/${ticket.id}`,
    }).catch(() => {})
  }

  return { success: true, id: ticket.id }
}

export async function approvePortalTicket(ticketId: string, decision: 'approve' | 'reject', reason?: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'client' || !session.user.isClientAdmin) return { success: false }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: session.user.clientId ?? '', status: 'pendiente_aprobacion', deletedAt: null },
    select: {
      id: true, title: true, tenantId: true, urgency: true, createdById: true,
      branch: { select: { name: true } },
      client: { select: { portalSlug: true } },
    },
  })
  if (!ticket) return { success: false, error: 'Ticket no encontrado o ya procesado' }

  const newStatus = decision === 'approve' ? 'nuevo' : 'cancelado'
  const note = decision === 'approve'
    ? 'Solicitud aprobada — INGEGAR notificado para asignación'
    : `Solicitud rechazada${reason ? `: ${reason}` : ''}`

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: newStatus, ...(decision === 'reject' ? { closedDate: new Date() } : {}) },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.user.id,
      fromStatus: 'pendiente_aprobacion',
      toStatus: newStatus,
      note,
      isInternal: false,
    },
  })

  if (decision === 'approve') {
    await notifyTenantStaff(ticket.tenantId, {
      type: 'ticket_new',
      title: `Ticket aprobado — pendiente asignación`,
      body: `${ticket.title}${ticket.branch?.name ? ` · ${ticket.branch.name}` : ''}`,
      href: `/tickets/${ticketId}`,
    }).catch(() => {})
  } else if (ticket.createdById) {
    await sendPushToUser(ticket.createdById, {
      title: 'Solicitud no aprobada',
      body: `"${ticket.title}"${reason ? ` — ${reason}` : ''}`,
      href: `/portal/${ticket.client?.portalSlug ?? 'portal'}/tickets/${ticketId}`,
    }).catch(() => {})
  }

  return { success: true }
}

export async function updatePortalTicket(ticketId: string, data: {
  title?: string
  description?: string
  urgency?: string
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'client') return { success: false }

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      clientId: session.user.clientId ?? '',
      status: { in: ['nuevo'] },
      deletedAt: null,
    },
    select: { id: true, title: true },
  })
  if (!ticket) return { success: false, error: 'Ticket no encontrado o no editable' }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...(data.title?.trim()             ? { title: data.title.trim() }                   : {}),
      ...(data.description !== undefined ? { description: data.description }              : {}),
      ...(data.urgency                   ? { urgency: data.urgency as TicketUrgency }     : {}),
    },
  })

  await prisma.ticketHistory.create({
    data: {
      ticketId,
      userId: session.user.id,
      note: 'Cliente editó el requerimiento',
      isInternal: false,
    },
  })

  return { success: true }
}

export async function addPortalTicketItem(ticketId: string, item: { title: string; description?: string }) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'client') return { success: false }

  const title = item.title.trim()
  if (!title) return { success: false }

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      clientId: session.user.clientId ?? '',
      status: { in: ['nuevo', 'en_revision'] },
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!ticket) return { success: false, error: 'No se pueden agregar sub-tareas en el estado actual' }

  const maxOrder = await prisma.ticketItem.aggregate({
    where: { ticketId },
    _max: { order: true },
  })

  const newItem = await prisma.ticketItem.create({
    data: {
      ticketId,
      title,
      description: item.description?.trim() || undefined,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  })

  return { success: true, item: newItem }
}

export async function addPortalComment(
  ticketId: string,
  note: string,
  files?: { key: string; name: string; mimeType: string }[],
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'client') return { success: false }
  const trimmed = note.trim()
  if (!trimmed && (!files || files.length === 0)) return { success: false }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId: session.user.clientId ?? '' },
    select: { id: true, tenantId: true, title: true },
  })
  if (!ticket) return { success: false }

  if (trimmed) {
    await prisma.ticketHistory.create({
      data: {
        ticketId,
        userId: session.user.id,
        note: trimmed,
        isInternal: false,
      },
    })
  }

  if (files && files.length > 0) {
    await prisma.ticketDocument.createMany({
      data: files.map(f => ({
        ticketId,
        uploadedById: session.user.id,
        name: f.name,
        fileUrl: f.key,
        mimeType: f.mimeType,
      })),
    })
  }

  // Notify INGEGAR staff of the new comment for traceability
  const body = trimmed
    ? `${session.user.name ?? 'Cliente'}: ${trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed}`
    : `${session.user.name ?? 'Cliente'} adjuntó ${files!.length} archivo(s)`
  await notifyTenantStaff(ticket.tenantId, {
    type: 'ticket_comment',
    title: `Comentario en ticket`,
    body,
    href: `/tickets/${ticketId}`,
  }).catch(() => {})

  return { success: true }
}
