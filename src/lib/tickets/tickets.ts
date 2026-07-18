import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'
import type { TicketStatus } from '@/generated/prisma/enums'

export type TicketWithRelations = Awaited<ReturnType<typeof getTickets>>[number]
export type TicketDetail = Awaited<ReturnType<typeof getTicket>>

const ticketSelect = {
  id: true,
  ticketCode: true,
  title: true,
  description: true,
  urgency: true,
  category: true,
  status: true,
  otNumber: true,
  estimatedDate: true,
  closedDate: true,
  folderKey: true,
  showToClient: true,
  createdAt: true,
  updatedAt: true,
  clientId: true,
  branchId: true,
  assignedToId: true,
  client: { select: { id: true, name: true, portalSlug: true } },
  branch: { select: { id: true, name: true, city: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true, documents: true, history: true } },
} as const

export async function getTickets(actor: TenantActor, filters?: {
  clientId?: string
  status?: string
  assignedToId?: string
}) {
  return prisma.ticket.findMany({
    where: {
      ...tenantScope(actor),
      deletedAt: null,
      ...(filters?.clientId     ? { clientId: filters.clientId }        : {}),
      ...(filters?.assignedToId ? { assignedToId: filters.assignedToId }: {}),
      status: filters?.status
        ? (filters.status as TicketStatus)
        : { notIn: ['fusionado', 'cancelado'] as TicketStatus[] },
    },
    select: ticketSelect,
    // Ordenado por fecha de creación: lo no atendido suele ser lo más nuevo.
    // Sin take: un límite fijo aquí trunca tickets en silencio (ver G31) —
    // filtrado/orden ya son 100% client-side, así que la página necesita el
    // set completo. Revisar paginación real si el volumen crece a miles.
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTicket(actor: TenantActor, id: string) {
  return prisma.ticket.findFirst({
    where: { id, ...tenantScope(actor) },
    include: {
      client: { select: { id: true, name: true, portalSlug: true } },
      branch: { select: { id: true, name: true, city: true } },
      assignedTo: { select: { id: true, name: true, technician: { select: { id: true } } } },
      createdBy: { select: { id: true, name: true } },
      collaborators: { include: { technician: { select: { id: true, name: true } } } },
      items: { orderBy: { order: 'asc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      history: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  })
}

const clientTicketSelect = {
  id: true,
  ticketCode: true,
  title: true,
  description: true,
  urgency: true,
  category: true,
  status: true,
  otNumber: true,
  estimatedDate: true,
  closedDate: true,
  folderKey: true,
  showToClient: true,
  createdAt: true,
  updatedAt: true,
  clientId: true,
  branchId: true,
  assignedToId: true,
  client: { select: { id: true, name: true, portalSlug: true } },
  branch: { select: { id: true, name: true, city: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { items: true, documents: true, history: true } },
} as const

export type ClientTicket = Awaited<ReturnType<typeof getClientTickets>>[number]

// Portal: client-scoped, strips internal data. Paridad con /tickets interno:
// el cliente ve TODOS sus tickets (incluidos resueltos) — el cliente crea,
// nosotros atendemos, y el estado debe reflejarse siempre en el portal.
// branchId: if set, only return tickets for that branch (branch user scoping)
export async function getClientTickets(clientId: string, branchId?: string | null) {
  return prisma.ticket.findMany({
    where: {
      clientId,
      deletedAt: null,
      status: { notIn: ['fusionado'] as TicketStatus[] },
      ...(branchId ? { branchId } : {}),
    },
    select: clientTicketSelect,
    orderBy: { createdAt: 'desc' },
  })
}

export async function getClientTicket(clientId: string, ticketId: string) {
  const t = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId },
    include: {
      branch: { select: { id: true, name: true, city: true } },
      assignedTo: { select: { id: true, name: true } },
      items: { orderBy: { order: 'asc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      history: {
        where: { isInternal: false },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, role: true } } },
      },
    },
  })
  if (!t) return null
  const { internalNotes: _stripped, ...safe } = t
  return safe
}
