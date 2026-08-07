'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { publishNotification, publishToTenantStaff } from '@/lib/notifications/service'
import { ticketFolderKey } from '@/lib/r2'
import type { TicketUrgency, TicketStatus } from '@/generated/prisma/enums'
import { ticketCodePrefix, clientTicketPrefix } from '@/lib/tickets/ticket-code'
import { createTicketWithUniqueCode } from '@/lib/tickets/ticket-code-server'

export type PortalRequirementInput = {
  category?: string
  title: string
  description?: string
  comment?: string
  files: { key: string; name: string; mimeType: string }[]
}

export async function createPortalTicket(input: {
  clientId: string
  createdById?: string
  branchId?: string
  urgency: string
  processFlow: string
  requirements: PortalRequirementInput[]
}) {
  const session = await auth()
  const role = session?.user?.role
  const isStaff = role === 'super' || role === 'supervisor'
  const isClient = role === 'client'
  const isClientAdmin = session?.user?.isClientAdmin ?? false
  if (!session?.user || (!isStaff && !isClient)) return { success: false }

  const clientId    = input.clientId
  const createdById = input.createdById ?? session.user.id
  const branchId    = input.branchId || (session.user.branchId ?? undefined)
  const urgency     = input.urgency
  const processFlow = input.processFlow === 'pre_quote' || input.processFlow === 'post_execution' ? input.processFlow : null
  if (!processFlow) return { success: false }

  // FASE 2 (múltiples requerimientos): el ticket es el contenedor -- sucursal/
  // urgencia/modalidad se ingresan una sola vez; cada problema reportado es su
  // propio TicketItem (categoría/título/descripción/comentario/archivos
  // propios). "No enviar sin al menos un requerimiento" -- ver brief.
  const requirements = (input.requirements ?? [])
    .map(r => ({
      category: r.category?.trim() || undefined,
      title: r.title.trim(),
      description: r.description?.trim() || undefined,
      comment: r.comment?.trim() || undefined,
      files: r.files ?? [],
    }))
    .filter(r => r.title)
  if (requirements.length === 0 || !clientId) return { success: false }

  // Client: must match their own clientId
  if (isClient && session.user.clientId !== clientId) return { success: false }

  const [branch, client] = await Promise.all([
    // active: true acá es lo que de verdad bloquea crear contra una sucursal
    // desactivada -- antes esta query no lo filtraba, así que un branchId de
    // una sucursal inactiva (POST directo, o un usuario de sucursal cuya
    // sucursal se desactivó después de asignársela) devolvía null y el
    // código seguía igual, con un branchId inválido guardado en el ticket y
    // el código armado con el fallback 'SUCURSAL'. Ahora, si se mandó un
    // branchId y no resuelve (no existe, es de otro cliente, o está
    // inactiva), se rechaza el ticket entero más abajo en vez de crearlo con
    // una referencia de sucursal que no debería existir.
    branchId ? prisma.branch.findUnique({ where: { id: branchId, clientId, active: true }, select: { name: true } }) : Promise.resolve(null),
    prisma.client.findUnique({ where: { id: clientId }, select: { tenantId: true, portalSlug: true, name: true } }),
  ])
  if (!client) return { success: false }
  if (branchId && !branch) return { success: false }

  // Staff: can only create for clients belonging to their tenant
  if (isStaff && client.tenantId !== session.user.tenantId) return { success: false }

  const prefix = ticketCodePrefix({
    clientPrefix: clientTicketPrefix(client),
    branchName: branch?.name ?? 'SUCURSAL',
    processFlow,
  })

  // Branch users (non-admin clients) → pendiente_aprobacion for the client admin to review
  const isBranchUser = isClient && !isClientAdmin
  const ticketStatus = isBranchUser ? 'pendiente_aprobacion' : 'nuevo'

  // Ticket.title/description/category/clientComment siguen existiendo (todo
  // el resto de la app -- listas, notificaciones, búsqueda -- los lee
  // directo) y quedan como una vista plana de compatibilidad: para un solo
  // requerimiento son exactamente los mismos datos que antes (ticket
  // "clásico" de un solo requerimiento sigue funcionando igual); para varios,
  // el título resume todos y el resto queda en cada TicketItem, la fuente de
  // verdad real del desglose.
  const first = requirements[0]
  const title = requirements.length === 1
    ? first.title
    : `${requirements.length} requerimientos: ${requirements.map(r => r.title).join(' · ')}`
  const description   = requirements.length === 1 ? first.description : undefined
  const category       = requirements.length === 1 ? first.category : undefined
  const clientComment = requirements.length === 1 ? first.comment : undefined

  // Guardia de doble-envío: el único freno que existía era disabled={isPending}
  // en el cliente, que no cubre un doble-tap real antes de que React re-renderice,
  // ni un reenvío por bfcache/back-button. No hay idempotency key -- en vez de
  // agregar un campo nuevo al form (cambio de contrato), se detecta un envío
  // idéntico (mismo cliente/sucursal/creador/título/descripción) creado hace
  // menos de 5s y se devuelve ESE ticket en vez de crear uno segundo. Una
  // ventana de 5s es coherente con un doble-clic/doble-tap real; dos
  // solicitudes legítimas distintas con texto idéntico en ese margen son
  // prácticamente inexistentes en el uso real.
  const recentDuplicate = await prisma.ticket.findFirst({
    where: {
      clientId, branchId: branchId ?? null, createdById, title, description: description ?? null,
      createdAt: { gte: new Date(Date.now() - 5_000) },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })
  if (recentDuplicate) return { success: true, id: recentDuplicate.id }

  const ticket = await createTicketWithUniqueCode(prefix, (code) =>
    prisma.ticket.create({
      data: {
        ticketCode: code,
        title,
        description,
        clientComment,
        urgency: urgency as TicketUrgency,
        category,
        processFlow,
        status: ticketStatus,
        clientId,
        branchId,
        tenantId: client.tenantId,
        createdById,
        folderKey: ticketFolderKey(clientTicketPrefix(client), code),
      },
    }),
  )

  // Un TicketItem por requerimiento -- incluso cuando hay uno solo, para que
  // el desglose estructurado exista siempre en tickets nuevos (los tickets
  // históricos de antes de esta fase simplemente tienen items.length === 0,
  // y toda vista que los renderiza ya cae de vuelta a los campos planos de
  // arriba -- compatibilidad sin migrar nada).
  for (let i = 0; i < requirements.length; i++) {
    const r = requirements[i]
    const item = await prisma.ticketItem.create({
      data: {
        ticketId: ticket.id,
        title: r.title,
        description: r.description,
        category: r.category,
        comment: r.comment,
        order: i,
      },
    })
    if (r.files.length > 0) {
      await prisma.ticketDocument.createMany({
        data: r.files.map(f => ({
          ticketId: ticket.id,
          itemId: item.id,
          uploadedById: createdById,
          name: f.name,
          fileUrl: f.key,
          mimeType: f.mimeType,
        })),
      })
    }
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
    // Notify the client admin to approve or reject
    const clientAdmin = await prisma.user.findFirst({
      where: { clientId, isClientAdmin: true, active: true },
      select: { id: true },
    })
    if (clientAdmin) {
      await publishNotification(clientAdmin.id, client.tenantId, 'client_branch_request_pending', {
        title: `Nueva solicitud de ${branch?.name ?? 'sucursal'} — revisar`,
        body: `${urgencyLabel[urgency] ?? urgency}: ${title}`,
        href: `/portal/${client.portalSlug ?? 'portal'}/tickets/${ticket.id}`,
      }).catch(() => {})
    }
  } else {
    await publishToTenantStaff(client.tenantId, 'admin_ticket_new', {
      title: `Nuevo ticket — ${client.name}`,
      body: `${urgencyLabel[urgency] ?? urgency}: ${title}${branch ? ` · ${branch.name}` : ''}`,
      href: `/tickets/${ticket.id}`,
    }).catch(() => {})
  }

  revalidatePath(`/portal/${client.portalSlug ?? ''}/tickets`)
  revalidatePath('/tickets')

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
    await publishToTenantStaff(ticket.tenantId, 'admin_ticket_new', {
      title: `Ticket aprobado — pendiente asignación`,
      body: `${ticket.title}${ticket.branch?.name ? ` · ${ticket.branch.name}` : ''}`,
      href: `/tickets/${ticketId}`,
    }).catch(() => {})
  } else if (ticket.createdById) {
    await publishNotification(ticket.createdById, ticket.tenantId, 'client_ticket_cancelled', {
      title: 'Solicitud no aprobada',
      body: `"${ticket.title}"${reason ? ` — ${reason}` : ''}`,
      href: `/portal/${ticket.client?.portalSlug ?? 'portal'}/tickets/${ticketId}`,
    }).catch(() => {})
  }

  const portalSlug = ticket.client?.portalSlug ?? ''
  revalidatePath(`/portal/${portalSlug}/tickets`)
  revalidatePath(`/portal/${portalSlug}/tickets/${ticketId}`)
  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)

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
    select: { id: true, title: true, client: { select: { portalSlug: true } } },
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

  const portalSlug = ticket.client?.portalSlug ?? ''
  revalidatePath(`/portal/${portalSlug}/tickets`)
  revalidatePath(`/portal/${portalSlug}/tickets/${ticketId}`)
  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)

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
    select: { id: true, client: { select: { portalSlug: true } } },
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

  revalidatePath(`/portal/${ticket.client?.portalSlug ?? ''}/tickets/${ticketId}`)
  revalidatePath(`/tickets/${ticketId}`)

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
    select: { id: true, tenantId: true, title: true, client: { select: { portalSlug: true } } },
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
  await publishToTenantStaff(ticket.tenantId, 'admin_ticket_comment', {
    title: `Comentario en ticket`,
    body,
    href: `/tickets/${ticketId}`,
  }).catch(() => {})

  revalidatePath(`/portal/${ticket.client?.portalSlug ?? ''}/tickets/${ticketId}`)
  revalidatePath(`/tickets/${ticketId}`)

  return { success: true }
}

// Fusionar/desfusionar es 100% del cliente (admin del cliente, portal) — ver
// .claude/rules/data.md sobre Ticket.parentTicketId (sin @relation
// declarada, se resuelve con queries propias). No hay contraparte en
// INGEGAR One: el equipo solo lo ve de forma informativa en el detalle del
// ticket (ver-controls.tsx), nunca lo dispara.

const NOT_MERGEABLE: TicketStatus[] = ['resuelto', 'cancelado', 'fusionado']

export async function mergeTickets(parentId: string, childIds: string[]) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'client' || !session.user.isClientAdmin) return { success: false }
  const clientId = session.user.clientId ?? ''
  const ids = [...new Set(childIds)].filter((id) => id !== parentId)
  if (ids.length === 0) return { success: false, error: 'Selecciona al menos 2 tickets' }

  const tickets = await prisma.ticket.findMany({
    where: { id: { in: [parentId, ...ids] }, clientId, deletedAt: null },
    select: { id: true, ticketCode: true, status: true, tenantId: true, client: { select: { portalSlug: true } } },
  })
  const parent = tickets.find((t) => t.id === parentId)
  const children = tickets.filter((t) => ids.includes(t.id))
  if (!parent || children.length !== ids.length) return { success: false, error: 'Ticket no encontrado' }
  if (NOT_MERGEABLE.includes(parent.status as TicketStatus) || children.some((c) => NOT_MERGEABLE.includes(c.status as TicketStatus))) {
    return { success: false, error: 'Solo se pueden fusionar tickets abiertos' }
  }

  await Promise.all(children.map((child) =>
    prisma.$transaction([
      prisma.ticket.update({
        where: { id: child.id },
        data: { status: 'fusionado', parentTicketId: parentId },
      }),
      prisma.ticketHistory.create({
        data: {
          ticketId: child.id,
          userId: session.user.id,
          fromStatus: child.status,
          toStatus: 'fusionado',
          note: `Fusionado por el cliente en ${parent.ticketCode}`,
          isInternal: false,
        },
      }),
    ]),
  ))

  await publishToTenantStaff(parent.tenantId, 'admin_ticket_merge', {
    title: `${children.length} ticket(s) fusionados`,
    body: `El cliente fusionó ${children.length} ticket(s) en ${parent.ticketCode}`,
    href: `/tickets/${parentId}`,
  }).catch(() => {})

  const portalSlug = parent.client?.portalSlug ?? ''
  revalidatePath(`/portal/${portalSlug}/tickets`)
  revalidatePath('/tickets')
  for (const c of children) {
    revalidatePath(`/portal/${portalSlug}/tickets/${c.id}`)
    revalidatePath(`/tickets/${c.id}`)
  }
  revalidatePath(`/tickets/${parentId}`)

  return { success: true }
}

export async function unmergeTicket(childId: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'client' || !session.user.isClientAdmin) return { success: false }
  const clientId = session.user.clientId ?? ''

  const ticket = await prisma.ticket.findFirst({
    where: { id: childId, clientId, status: 'fusionado', deletedAt: null },
    select: { id: true, tenantId: true, client: { select: { portalSlug: true } } },
  })
  if (!ticket) return { success: false, error: 'Ticket no encontrado o no está fusionado' }

  // El status real previo a la fusión quedó guardado en el fromStatus de la
  // entrada de historial que la propia fusión creó — se recupera de ahí en
  // vez de asumir un valor fijo.
  const lastMerge = await prisma.ticketHistory.findFirst({
    where: { ticketId: childId, toStatus: 'fusionado' },
    orderBy: { createdAt: 'desc' },
    select: { fromStatus: true },
  })
  const restoredStatus = (lastMerge?.fromStatus ?? 'nuevo') as TicketStatus

  await prisma.$transaction([
    prisma.ticket.update({
      where: { id: childId },
      data: { status: restoredStatus, parentTicketId: null },
    }),
    prisma.ticketHistory.create({
      data: {
        ticketId: childId,
        userId: session.user.id,
        fromStatus: 'fusionado',
        toStatus: restoredStatus,
        note: 'Desfusionado por el cliente',
        isInternal: false,
      },
    }),
  ])

  await publishToTenantStaff(ticket.tenantId, 'admin_ticket_merge', {
    title: 'Ticket desfusionado',
    body: 'El cliente deshizo una fusión de tickets',
    href: `/tickets/${childId}`,
  }).catch(() => {})

  const portalSlug = ticket.client?.portalSlug ?? ''
  revalidatePath(`/portal/${portalSlug}/tickets`)
  revalidatePath(`/portal/${portalSlug}/tickets/${childId}`)
  revalidatePath('/tickets')
  revalidatePath(`/tickets/${childId}`)

  return { success: true }
}
