import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

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
  driveFolderUrl: true,
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
      ...(filters?.clientId     ? { clientId: filters.clientId }        : {}),
      ...(filters?.assignedToId ? { assignedToId: filters.assignedToId }: {}),
      status: filters?.status
        ? (filters.status as never)
        : { notIn: ['fusionado', 'cancelado'] as never[] },
    },
    select: ticketSelect,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })
}

export async function getTicket(actor: TenantActor, id: string) {
  return prisma.ticket.findFirst({
    where: { id, ...tenantScope(actor) },
    include: {
      client: { select: { id: true, name: true, portalSlug: true } },
      branch: { select: { id: true, name: true, city: true } },
      assignedTo: { select: { id: true, name: true } },
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

// Portal: client-scoped, strips internal data
export async function getClientTickets(clientId: string) {
  return prisma.ticket.findMany({
    where: { clientId, showToClient: true, status: { notIn: ['fusionado'] as never[] } },
    select: {
      ...ticketSelect,
      internalNotes: false, // never exposed to client
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getClientTicket(clientId: string, ticketId: string) {
  const t = await prisma.ticket.findFirst({
    where: { id: ticketId, clientId, showToClient: true },
    include: {
      branch: { select: { id: true, name: true, city: true } },
      assignedTo: { select: { id: true, name: true } },
      items: { orderBy: { order: 'asc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      history: {
        where: { isInternal: false },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  })
  if (!t) return null
  // Strip internalNotes before returning
  const { internalNotes: _stripped, ...safe } = t
  return safe
}
