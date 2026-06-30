import { prisma } from '@/lib/prisma'
import { tenantScope, type TenantActor } from '@/lib/tenant'

const withRefs = {
  tenant: { select: { slug: true } },
  client: { select: { id: true, name: true } },
  ticket: { select: { id: true, ticketCode: true, title: true, urgency: true, status: true } },
  assignees: {
    include: { technician: { select: { id: true, name: true } } },
  },
} as const

export async function listAssignments(actor: TenantActor, opts: {
  from?: Date
  to?: Date
  technicianId?: string
} = {}) {
  return prisma.assignment.findMany({
    where: {
      ...tenantScope(actor),
      ...(opts.from || opts.to ? {
        start: {
          ...(opts.from ? { gte: opts.from } : {}),
          ...(opts.to   ? { lte: opts.to }   : {}),
        },
      } : {}),
      ...(opts.technicianId ? {
        assignees: { some: { technicianId: opts.technicianId } },
      } : {}),
    },
    include: withRefs,
    orderBy: [{ start: 'asc' }],
  })
}

export async function getAssignment(actor: TenantActor, id: string) {
  return prisma.assignment.findFirst({
    where: { id, ...tenantScope(actor) },
    include: {
      assignees: { select: { technicianId: true, role: true } },
      ticket: { select: { id: true, ticketCode: true, title: true } },
    },
  })
}

// Options for the assignment form selects.
export async function assignmentOptions(actor: TenantActor) {
  const [technicians, clients, openTickets] = await Promise.all([
    prisma.technician.findMany({
      where: { ...tenantScope(actor), active: true },
      select: { id: true, name: true, specialty: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      where: { ...tenantScope(actor) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Tickets abiertos sin asignación a cronograma todavía
    prisma.ticket.findMany({
      where: {
        ...tenantScope(actor),
        status: { notIn: ['resuelto', 'cancelado', 'fusionado'] },
        deletedAt: null,
      },
      select: { id: true, ticketCode: true, title: true, urgency: true, client: { select: { name: true } } },
      orderBy: [{ urgency: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    }),
  ])
  return { technicians, clients, openTickets }
}

// Workload per technician for a date range (used in "carga laboral" view)
export async function getTechnicianWorkload(actor: TenantActor, from: Date, to: Date) {
  const technicians = await prisma.technician.findMany({
    where: { ...tenantScope(actor), active: true },
    select: { id: true, name: true, specialty: true },
    orderBy: { name: 'asc' },
  })

  const assignees = await prisma.assignmentAssignee.findMany({
    where: {
      technicianId: { in: technicians.map(t => t.id) },
      assignment: {
        ...tenantScope(actor),
        start: { gte: from, lte: to },
        status: { not: 'cancelled' },
      },
    },
    include: {
      assignment: {
        select: {
          id: true, title: true, start: true, end: true,
          status: true, client: { select: { name: true } },
          ticket: { select: { ticketCode: true, urgency: true } },
        },
      },
    },
  })

  return technicians.map(tech => {
    const techAssignees = assignees.filter(a => a.technicianId === tech.id)
    const assignments = techAssignees.map(a => a.assignment)
    const totalMinutes = assignments.reduce((s, a) => {
      return s + Math.round((new Date(a.end).getTime() - new Date(a.start).getTime()) / 60000)
    }, 0)
    return {
      ...tech,
      assignments,
      totalJobs: assignments.length,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    }
  })
}

export type AssignmentListItem = Awaited<ReturnType<typeof listAssignments>>[number]
export type AssignmentOptions = Awaited<ReturnType<typeof assignmentOptions>>
export type TechWorkload = Awaited<ReturnType<typeof getTechnicianWorkload>>[number]
