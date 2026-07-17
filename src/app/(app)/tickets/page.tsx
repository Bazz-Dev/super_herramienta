import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { tenantScope, requireActor } from '@/lib/tenant'
import { getTickets } from '@/lib/tickets/tickets'
import { TicketListView } from '@/components/tickets/ticket-list-view'
import { URGENCY_PRIORITY, STATUS_PRIORITY, type TicketUrgencyId, type TicketStatusId } from '@/lib/tickets/labels'

export const metadata = { title: 'Tickets — INGEGAR' }

export default async function TicketsPage() {
  // requireActor aplica "ver como" (viewas) — no usar session.user directo aquí
  const actor = await requireActor()

  const [tickets, clients, users, closed] = await Promise.all([
    getTickets(actor),
    prisma.client.findMany({
      where: tenantScope(actor),
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { ...tenantScope(actor), role: { in: ['super', 'supervisor'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.ticket.findMany({
      where: { tenantId: actor.tenantId, status: { in: ['resuelto', 'cancelado'] } },
      select: {
        id: true, ticketCode: true, title: true, description: true, status: true, closedDate: true,
        client: { select: { name: true } },
        branch: { select: { name: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { documents: true } },
      },
      orderBy: { closedDate: 'desc' },
      take: 50,
    }),
  ])

  // Sort: open tickets first, then by urgency priority, then newest
  const sorted = [...tickets].sort((a, b) => {
    const aResolved = a.status === 'resuelto'
    const bResolved = b.status === 'resuelto'
    if (aResolved !== bResolved) return aResolved ? 1 : -1
    const urgDiff = (URGENCY_PRIORITY[a.urgency as TicketUrgencyId] ?? 9) - (URGENCY_PRIORITY[b.urgency as TicketUrgencyId] ?? 9)
    if (urgDiff !== 0) return urgDiff
    const statusDiff = (STATUS_PRIORITY[a.status as TicketStatusId] ?? 9) - (STATUS_PRIORITY[b.status as TicketStatusId] ?? 9)
    if (statusDiff !== 0) return statusDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const nowMs = Date.now()
  const needsAttention = sorted.filter(t => t.status === 'nuevo' && !t.assignedToId).length
  const emergencias    = sorted.filter(t => t.urgency === 'emergencia').length
  const sinAbordar24h  = sorted.filter(t =>
    t.status === 'nuevo' &&
    (nowMs - new Date(t.createdAt).getTime()) > 86_400_000,
  ).length

  // Serialize dates to ISO strings for client component
  const serialized = sorted.map(t => ({
    id: t.id,
    ticketCode: t.ticketCode,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    urgency: t.urgency,
    createdAt: t.createdAt.toISOString(),
    estimatedDate: t.estimatedDate ? t.estimatedDate.toISOString() : null,
    client: t.client,
    branch: t.branch ? { id: t.branch.id, name: t.branch.name } : null,
    assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: t.assignedTo.name } : null,
    _count: t._count,
  }))

  const serializedClosed = closed.map(t => ({
    id: t.id,
    ticketCode: t.ticketCode,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    closedDate: t.closedDate ? t.closedDate.toISOString() : null,
    client: t.client,
    branch: t.branch ? { name: t.branch.name } : null,
    assignedTo: t.assignedTo ? { name: t.assignedTo.name } : null,
    _count: { documents: t._count.documents },
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Tickets de mantención</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">{sorted.length} activos</span>
            {needsAttention > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                {needsAttention} sin asignar
              </span>
            )}
            {sinAbordar24h > 0 && (
              <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
                {sinAbordar24h} sin abordar +24h
              </span>
            )}
            {emergencias > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                🚨 {emergencias} emergencia{emergencias > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <Link
          href="/tickets/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90"
        >
          + Nuevo ticket
        </Link>
      </div>

      <TicketListView tickets={serialized} clients={clients} users={users} closedTickets={serializedClosed}  />
    </div>
  )
}
