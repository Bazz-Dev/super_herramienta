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
  // createdBy deliberadamente NO va aquí — ni /tickets ni TicketListView lo
  // usan, y cada relación es un round-trip separado contra Turso (ver G41).
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
        : { notIn: ['fusionado', 'cancelado', 'resuelto'] as TicketStatus[] },
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
      documents: {
        orderBy: { uploadedAt: 'desc' },
        // role del uploader → origen (cliente/técnico/administrador) en el
        // panel de documentos unificado, sin agregar una columna nueva.
        include: { uploadedBy: { select: { name: true, role: true } } },
      },
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
  // Sin client ni createdBy: getClientTickets() ya está scopeado a UN cliente
  // (clientId es param), así que client.* sería el mismo dato repetido en
  // cada fila; createdBy nunca se renderiza en portal-ticket-list/reportes/
  // dashboard. Cada relación es un round-trip separado contra Turso (G41) —
  // confirmado con grep de los 3 consumidores antes de sacarlos.
  branch: { select: { id: true, name: true, city: true } },
  assignedTo: { select: { id: true, name: true } },
  _count: { select: { items: true, documents: true, history: true } },
} as const

export type ClientTicket = Awaited<ReturnType<typeof getClientTickets>>[number]

// Portal: client-scoped, strips internal data. Paridad con /tickets interno:
// el cliente ve TODOS sus tickets (incluidos resueltos) — el cliente crea,
// nosotros atendemos, y el estado debe reflejarse siempre en el portal —
// salvo los que staff marcó showToClient=false (ver checkbox en TicketControls).
// branchId: if set, only return tickets for that branch (branch user scoping)
export async function getClientTickets(clientId: string, branchId?: string | null) {
  return prisma.ticket.findMany({
    where: {
      clientId,
      deletedAt: null,
      showToClient: true,
      status: { notIn: ['fusionado'] as TicketStatus[] },
      ...(branchId ? { branchId } : {}),
    },
    select: clientTicketSelect,
    orderBy: { createdAt: 'desc' },
  })
}

// branchId: si se pasa, solo devuelve el ticket si además pertenece a esa
// sucursal (mismo criterio que getClientTickets, ver data.md G45). Opcional y
// sin efecto si se omite -- el único caller de hoy (portal/[slug]/tickets/[id])
// ya hace este chequeo después del fetch con su propio redirect a la lista,
// UX que no se toca acá. Esto existe para que un caller NUEVO (P1/P1B) no
// tenga que reinventar ese chequeo ni pueda olvidarlo -- la función misma ya
// lo hace cumplir si se lo piden.
export async function getClientTicket(clientId: string, ticketId: string, branchId?: string | null) {
  const t = await prisma.ticket.findFirst({
    // fusionado se excluye acá — el caller (portal/[slug]/tickets/[id]/page.tsx)
    // depende de que esto devuelva null para caer a su pantalla especial de
    // "Solicitud consolidada" en vez de mostrar el ticket como si nada.
    where: { id: ticketId, clientId, showToClient: true, status: { not: 'fusionado' }, ...(branchId ? { branchId } : {}) },
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
