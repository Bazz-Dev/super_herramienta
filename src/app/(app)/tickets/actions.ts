'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { assertRole } from '@/lib/policies'
import { notify } from '@/lib/push'
import { ticketFolderKey } from '@/lib/r2'
import { fromDateInput } from '@/lib/cashflow/dates'
import { ticketCodePrefix, clientTicketPrefix } from '@/lib/tickets/ticket-code'
import { createTicketWithUniqueCode } from '@/lib/tickets/ticket-code-server'
import type { TicketStatus } from '@/generated/prisma/enums'
import { logAudit } from '@/lib/audit'
import { isProposalApproved, canStartExecution } from '@/lib/tickets/ticket-state-summary'

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  urgency: z.enum(['emergencia', 'urgencia', 'no_urgente', 'preventivo']).default('no_urgente'),
  category: z.string().optional(),
  // Modalidad comercial (informe #2) — obligatoria en tickets nuevos desde
  // new-ticket-form.tsx; default defensivo por si algún caller viejo no la
  // manda todavía (mismo criterio que urgency arriba).
  processFlow: z.enum(['pre_quote', 'post_execution']).default('pre_quote'),
  clientId: z.string().min(1),
  branchId: z.string().optional(),
  assignedToId: z.string().optional(),
  internalNotes: z.string().optional(),
  otNumber: z.string().optional(),
  estimatedDate: z.string().optional(), // ISO datetime string (date + time combined)
})

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  urgency: z.enum(['emergencia', 'urgencia', 'no_urgente', 'preventivo']).optional(),
  category: z.string().optional(),
  status: z.enum(['nuevo','en_revision','en_ejecucion','esperando_aprobacion','resuelto','cancelado','fusionado']).optional(),
  processFlow: z.enum(['pre_quote', 'post_execution']).nullable().optional(),
  otNumber: z.string().optional(),
  estimatedDate: z.string().optional(),
  assignedToId: z.string().nullable().optional(),
  workSummary: z.string().optional(),
  clientComment: z.string().optional(),
  internalNotes: z.string().optional(),
  folderKey: z.string().optional(),
  branchId: z.string().nullable().optional(),
  showToClient: z.boolean().optional(),
})

// Job select mínimo para el gate de ejecución PP (informe #2) — solo
// commercialStage, ver isProposalApproved() en ticket-state-summary.ts.
async function latestCommercialContext(tenantId: string, ticketId: string) {
  const [job, propuesta] = await Promise.all([
    prisma.job.findFirst({
      where: { originTicketId: ticketId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: { commercialStage: true },
    }),
    prisma.clientDocument.findFirst({
      where: { tenantId, type: 'propuesta', ticketId },
      orderBy: { createdAt: 'desc' },
      select: { proposalStatus: true },
    }),
  ])
  return { job, propuesta }
}

export async function createTicket(_: unknown, fd: FormData) {
  const actor = await requireActor(['super', 'supervisor'])
  const parsed = createSchema.parse({
    title: fd.get('title'),
    description: fd.get('description') || undefined,
    urgency: fd.get('urgency') || 'no_urgente',
    category: fd.get('category') || undefined,
    processFlow: fd.get('processFlow') || undefined,
    clientId: fd.get('clientId'),
    branchId: fd.get('branchId') || undefined,
    assignedToId: fd.get('assignedToId') || undefined,
    internalNotes: fd.get('internalNotes') || undefined,
    otNumber: fd.get('otNumber') || undefined,
    estimatedDate: fd.get('estimatedDate') || undefined,
  })

  const { assignedToId, internalNotes, otNumber, estimatedDate, ...ticketData } = parsed
  const initialStatus = assignedToId ? 'en_revision' : 'nuevo'

  // Fetch client slug/name for R2 folder key + prefix, and branch name for prefix
  const [clientRecord, branchRecord] = await Promise.all([
    prisma.client.findUnique({ where: { id: parsed.clientId }, select: { portalSlug: true, name: true } }),
    parsed.branchId ? prisma.branch.findUnique({ where: { id: parsed.branchId }, select: { name: true } }) : Promise.resolve(null),
  ])
  if (!clientRecord) throw new Error('Cliente no encontrado.')

  // ticketCode es único: dos tickets del mismo día/cliente/urgencia/sucursal
  // colisionan — createTicketWithUniqueCode reintenta sobre la constraint real
  // en vez de adivinar con un check previo (mismo patrón que el portal).
  const prefix = ticketCodePrefix({
    clientPrefix: clientTicketPrefix({ portalSlug: clientRecord.portalSlug, name: clientRecord.name }),
    branchName: branchRecord?.name ?? 'SUCURSAL',
    processFlow: ticketData.processFlow,
  })
  const ticket = await createTicketWithUniqueCode(prefix, (code) =>
    prisma.ticket.create({
      data: {
        ...ticketData,
        ticketCode: code,
        assignedToId: assignedToId ?? null,
        internalNotes: internalNotes ?? null,
        otNumber: otNumber ?? null,
        // estimatedDate acá ya viene "YYYY-MM-DDTHH:MM:00" (fecha+hora
        // combinadas por new-ticket-form.tsx) — fromDateInput() es solo para
        // fechas puras (le agrega T00:00:00.000Z, lo que rompía este string ya
        // compuesto y dejaba la fecha en null siempre). Ancla a UTC igual que
        // fromDateInput, solo que sin duplicar la parte de hora.
        estimatedDate: estimatedDate ? new Date(`${estimatedDate}Z`) : null,
        tenantId: actor.tenantId,
        createdById: actor.id,
        status: initialStatus,
        // Auto-assign R2 folder key on creation (no API call needed — just a path prefix)
        folderKey: ticketFolderKey(clientRecord?.portalSlug ?? 'ingegar', code),
      },
    }),
  )

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
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'ticket.create', entityType: 'Ticket', entityId: ticket.id,
    after: { ticketCode: ticket.ticketCode, clientId: ticketData.clientId, assignedToId: assignedToId ?? null, status: initialStatus },
    source: 'tickets/actions.ts:createTicket',
  })

  // Notify assigned user if staff assigned on creation
  if (assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, tenantId: true, role: true } })
    if (assignee) {
      // El técnico no tiene acceso a /tickets — su detalle vive en /mi-panel/tickets
      const href = assignee.role === 'tecnico' ? `/mi-panel/tickets/${ticket.id}` : `/tickets/${ticket.id}`
      notify(assignee.id, assignee.tenantId, {
        type: 'ticket_assigned',
        title: `Ticket asignado: ${ticket.ticketCode}`,
        body: ticket.title,
        href,
      }).catch(() => {})
    }
  }

  revalidatePath('/tickets')
  return { success: true, id: ticket.id }
}

// "Reabierto"/"cerrado" (informe #32B punto 1) — no duplica en AuditLog:
// TicketHistory ya registra fromStatus/toStatus/actor/timestamp para TODA
// transición (incluida resuelto/cancelado→cualquier otro = "reabrir"), es la
// fuente correcta. Documentado en GAP_REGISTER G49.1 como correspondencia
// explícita, no como brecha.
export async function updateTicketStatus(ticketId: string, newStatus: string, note?: string) {
  const actor = await requireActor(['super', 'supervisor'])

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId },
    select: { id: true, status: true, title: true, ticketCode: true, createdById: true, processFlow: true, client: { select: { portalSlug: true } } },
  })
  if (!ticket) return { success: false, error: 'Ticket no encontrado.' }

  // Gate PP (informe #2): staff tampoco puede saltarse la propuesta aprobada
  // — el mismo límite que tecnicoAdvanceStatus() aplica a técnicos, si no
  // quedaría como una puerta trasera que vacía la regla de sentido.
  if (newStatus === 'en_ejecucion') {
    const { job, propuesta } = await latestCommercialContext(actor.tenantId, ticketId)
    if (!canStartExecution(ticket.processFlow, isProposalApproved(job, propuesta))) {
      return { success: false, error: 'Esta modalidad (Presupuesto previo) requiere una propuesta aprobada antes de iniciar ejecución.' }
    }
  }

  const closedDate = ['resuelto', 'cancelado'].includes(newStatus) ? new Date() : undefined

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: newStatus as TicketStatus,
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
  // El cliente ve todos sus tickets (paridad de portal) → siempre se notifica.
  if (ticket.createdById && STATUS_ES[newStatus]) {
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
  const actor = await requireActor(['super', 'supervisor'])

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId },
    select: { id: true, status: true, assignedToId: true, ticketCode: true, title: true, showToClient: true, otNumber: true, estimatedDate: true, workSummary: true, processFlow: true },
  })
  if (!ticket) return { success: false }

  const parsed = updateSchema.parse(data)

  // Auto-advance status: assigning technician → en_revision
  let autoStatus: string | undefined
  const assigneeChanged = parsed.assignedToId !== undefined && parsed.assignedToId !== ticket.assignedToId
  if (parsed.assignedToId && assigneeChanged && ticket.status === 'nuevo') {
    autoStatus = 'en_revision'
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...parsed,
      estimatedDate: parsed.estimatedDate !== undefined ? fromDateInput(parsed.estimatedDate) : undefined,
      ...(autoStatus ? { status: autoStatus as TicketStatus } : {}),
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

  // Cambios de status ya quedan en TicketHistory (arriba) — acá solo lo que
  // NO tiene un historial especializado propio: visibilidad al cliente.
  if (parsed.showToClient !== undefined && parsed.showToClient !== ticket.showToClient) {
    await logAudit({
      tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
      action: parsed.showToClient ? 'ticket.show_to_client' : 'ticket.hide_from_client',
      entityType: 'Ticket', entityId: ticketId,
      before: { showToClient: ticket.showToClient }, after: { showToClient: parsed.showToClient },
      source: 'tickets/actions.ts:updateTicketFields',
    })
  }

  // Técnico asignado/reasignado (informe #32B punto 2) — categoría propia,
  // separada de "editado": es una decisión de quién ejecuta, no un dato del
  // expediente. Cubre tanto la primera asignación (before null) como reasignar.
  if (assigneeChanged) {
    await logAudit({
      tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
      action: ticket.assignedToId ? 'ticket.reassign_technician' : 'ticket.assign_technician',
      entityType: 'Ticket', entityId: ticketId,
      before: { assignedToId: ticket.assignedToId }, after: { assignedToId: parsed.assignedToId },
      source: 'tickets/actions.ts:updateTicketFields',
    })
  }

  // "Ticket editado" (informe #32B punto 1) — acotado a los campos que este
  // formulario realmente envía (N° OT, fecha estimada, resumen de trabajo;
  // título/descripción/urgencia no tienen un caller real hoy, ver GAP_REGISTER).
  const otChanged = parsed.otNumber !== undefined && parsed.otNumber !== (ticket.otNumber ?? undefined)
  const dateChanged = parsed.estimatedDate !== undefined
  const summaryChanged = parsed.workSummary !== undefined && parsed.workSummary !== (ticket.workSummary ?? undefined)
  const processFlowChanged = parsed.processFlow !== undefined && parsed.processFlow !== ticket.processFlow
  if (otChanged || dateChanged || summaryChanged || processFlowChanged) {
    await logAudit({
      tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
      action: 'ticket.update', entityType: 'Ticket', entityId: ticketId,
      before: { otNumber: ticket.otNumber, estimatedDate: ticket.estimatedDate, workSummary: ticket.workSummary, processFlow: ticket.processFlow },
      after: { otNumber: parsed.otNumber ?? ticket.otNumber, estimatedDate: parsed.estimatedDate ?? ticket.estimatedDate, workSummary: parsed.workSummary ?? ticket.workSummary, processFlow: parsed.processFlow ?? ticket.processFlow },
      source: 'tickets/actions.ts:updateTicketFields',
    })
  }

  // Notify newly assigned user
  if (parsed.assignedToId && assigneeChanged) {
    const assignee = await prisma.user.findUnique({ where: { id: parsed.assignedToId }, select: { id: true, tenantId: true, role: true } })
    if (assignee) {
      const href = assignee.role === 'tecnico' ? `/mi-panel/tickets/${ticketId}` : `/tickets/${ticketId}`
      notify(assignee.id, assignee.tenantId, {
        type: 'ticket_assigned',
        title: `Ticket asignado: ${ticket.ticketCode}`,
        body: ticket.title,
        href,
      }).catch(() => {})
    }
  }

  revalidatePath('/tickets')
  revalidatePath(`/tickets/${ticketId}`)
  return { success: true }
}

export async function addTicketComment(ticketId: string, note: string, isInternal: boolean) {
  const actor = await requireActor(['super', 'supervisor'])

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

export async function bulkAssignResolvedTickets(assignedToId: string) {
  const actor = await requireActor(['super', 'supervisor'])
  assertRole(actor, ['super', 'supervisor'])

  const result = await prisma.ticket.updateMany({
    where: {
      tenantId: actor.tenantId,
      status: 'resuelto',
      assignedToId: null,
      deletedAt: null,
    },
    data: { assignedToId },
  })

  revalidatePath('/tickets')
  return { success: true, count: result.count }
}

export async function deleteTicket(ticketId: string) {
  const actor = await requireActor(['super', 'supervisor'])
  assertRole(actor, ['super', 'supervisor'])
  await prisma.ticket.updateMany({
    where: { id: ticketId, tenantId: actor.tenantId },
    data: { deletedAt: new Date() },
  })
  revalidatePath('/tickets')
  return { success: true }
}

// Promueve un documento ya subido a "Otros" a ser la OT del ticket, sin
// volver a subir el archivo — bug real encontrado en vivo: la ficha interna
// (ticket-controls.tsx) se quedó sin botón de subida de OT tras un refactor
// que consolidó "Adjuntos" en un único uploader genérico (el panel del
// técnico en /mi-panel sí lo conservó), así que staff terminaba subiendo el
// escaneo de la OT por el uploader genérico y quedaba en "Otros" sin
// completar nunca Ticket.otFileUrl. Reusa la MISMA key de R2 — nunca
// descarga ni vuelve a subir el archivo, solo repunta la referencia y borra
// la fila de TicketDocument (el archivo físico en R2 queda intacto, ahora
// referenciado desde otFileUrl, nunca duplicado). Rechaza si el ticket ya
// tiene una OT — evita pisar una real por accidente desde la lista
// genérica; para reemplazarla existe el botón dedicado "Reemplazar OT".
export async function promoteDocumentToOT(ticketId: string, documentId: string) {
  const actor = await requireActor(['super', 'supervisor'])

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: actor.tenantId },
    select: { id: true, otFileUrl: true },
  })
  if (!ticket) return { success: false, error: 'Ticket no encontrado.' }
  if (ticket.otFileUrl) return { success: false, error: 'Este ticket ya tiene una OT — usa "Reemplazar OT" si quieres cambiarla.' }

  const doc = await prisma.ticketDocument.findFirst({
    where: { id: documentId, ticketId },
    select: { id: true, fileUrl: true, name: true },
  })
  if (!doc) return { success: false, error: 'Documento no encontrado.' }

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { otFileUrl: doc.fileUrl } }),
    prisma.ticketDocument.delete({ where: { id: documentId } }),
  ])

  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'ticket_document.promote_to_ot', entityType: 'Ticket', entityId: ticketId,
    before: { otFileUrl: null }, after: { otFileUrl: doc.fileUrl, promotedFrom: doc.name },
    source: 'tickets/actions.ts:promoteDocumentToOT',
  })

  revalidatePath(`/tickets/${ticketId}`)
  return { success: true }
}

// Vincula un Job de Flujo de Caja sin Ticket al ticket recién creado desde
// /conciliacion (flujo "SIN TICKET -> Crear ticket"). originTicketId es el
// mismo mecanismo que ya usa /tickets/[id] para mostrar los trabajos de un
// ticket — no un campo nuevo.
export async function linkJobToNewTicket(jobId: string, ticketId: string) {
  const actor = await requireActor(['super', 'supervisor'])
  await prisma.job.updateMany({
    where: { id: jobId, tenantId: actor.tenantId, originTicketId: null },
    data: { originTicketId: ticketId },
  })
  revalidatePath('/conciliacion')
}
