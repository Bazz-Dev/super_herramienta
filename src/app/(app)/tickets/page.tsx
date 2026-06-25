import Link from 'next/link'
import { Suspense } from 'react'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { getTickets } from '@/lib/tickets/tickets'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import {
  KANBAN_COLUMNS,
  STATUS_COLOR,
  STATUS_LABEL,
  URGENCY_LABEL,
  URGENCY_COLOR,
  type TicketStatusId,
  type TicketUrgencyId,
} from '@/lib/tickets/labels'

export const metadata = { title: 'Tickets — INGEGAR' }

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; assignedToId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const actor = { id: session.user.id, tenantId: session.user.tenantId, role: session.user.role }

  const { clientId, assignedToId } = await searchParams

  const [tickets, clients, users] = await Promise.all([
    getTickets(actor, { clientId, assignedToId }),
    prisma.client.findMany({
      where: tenantScope(actor),
      select: { id: true, name: true, portalSlug: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { ...tenantScope(actor), role: { in: ['super', 'supervisor'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const grouped = KANBAN_COLUMNS.reduce<Record<string, typeof tickets>>(
    (acc, col) => {
      acc[col.status] = tickets.filter((t) => t.status === col.status)
      return acc
    },
    {} as Record<string, typeof tickets>,
  )

  // Count tickets needing attention (nuevo + unassigned)
  const needsAttention = tickets.filter((t) => t.status === 'nuevo' && !t.assignedToId).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Tickets de mantención</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tickets.length} activos
            {needsAttention > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {needsAttention} sin asignar
              </span>
            )}
          </p>
        </div>
        <Link
          href="/tickets/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90"
        >
          + Nuevo ticket
        </Link>
      </div>

      {/* Filters */}
      <Suspense>
        <TicketFilters clients={clients} users={users} />
      </Suspense>

      {/* Kanban */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const colTickets = grouped[col.status] ?? []
          return (
            <div key={col.status} className="flex flex-col gap-3">
              {/* Column header */}
              <div className={`flex items-center justify-between rounded-t-lg border-t-4 bg-white px-3 py-2 shadow-sm ${col.color}`}>
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                  {colTickets.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {colTickets.length === 0 && (
                  <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
                    Sin tickets
                  </p>
                )}
                {colTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="group rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand/40 hover:shadow-md"
                  >
                    {/* Client chip */}
                    <div className="mb-2 flex items-center justify-between gap-1">
                      <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        {ticket.client.name}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${URGENCY_COLOR[ticket.urgency as TicketUrgencyId]}`}>
                        {URGENCY_LABEL[ticket.urgency as TicketUrgencyId]}
                      </span>
                    </div>

                    {/* Ticket code */}
                    <p className="font-mono text-[10px] text-gray-400">{ticket.ticketCode}</p>

                    {/* Title */}
                    <p className="mt-0.5 text-sm font-medium text-gray-800 group-hover:text-ink line-clamp-2">
                      {ticket.title}
                    </p>

                    {/* Branch */}
                    {ticket.branch && (
                      <p className="mt-1 text-xs text-gray-500">📍 {ticket.branch.name}</p>
                    )}

                    {/* Footer */}
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                      <span>{ticket.assignedTo?.name ?? <span className="text-amber-600 font-medium">Sin asignar</span>}</span>
                      <div className="flex items-center gap-2">
                        {ticket._count.documents > 0 && (
                          <span title="Documentos">📎 {ticket._count.documents}</span>
                        )}
                        {ticket._count.items > 0 && (
                          <span title="Ítems">☑ {ticket._count.items}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Closed tickets section */}
      <ClosedSection tenantScope={actor} clientId={clientId} />
    </div>
  )
}

async function ClosedSection({
  tenantScope: actor,
  clientId,
}: {
  tenantScope: { id: string; tenantId: string; role: string }
  clientId?: string
}) {
  const closed = await prisma.ticket.findMany({
    where: {
      tenantId: actor.tenantId,
      status: { in: ['resuelto', 'cancelado'] },
      ...(clientId ? { clientId } : {}),
    },
    select: {
      id: true,
      ticketCode: true,
      title: true,
      status: true,
      closedDate: true,
      client: { select: { name: true } },
      branch: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { closedDate: 'desc' },
    take: 20,
  })

  if (closed.length === 0) return null

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Cerrados recientes</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 text-left">Código</th>
              <th className="px-4 py-2 text-left">Título</th>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Sucursal</th>
              <th className="px-4 py-2 text-left">Estado</th>
              <th className="px-4 py-2 text-left">Técnico</th>
              <th className="px-4 py-2 text-left">Fecha cierre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {closed.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-2 font-mono text-xs text-gray-400">
                  <Link href={`/tickets/${t.id}`} className="hover:text-brand">{t.ticketCode}</Link>
                </td>
                <td className="px-4 py-2 text-gray-700">
                  <Link href={`/tickets/${t.id}`} className="hover:text-brand">{t.title}</Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{t.client.name}</td>
                <td className="px-4 py-2 text-gray-500">{t.branch?.name ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status as TicketStatusId]}`}>
                    {STATUS_LABEL[t.status as TicketStatusId]}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500">{t.assignedTo?.name ?? '—'}</td>
                <td className="px-4 py-2 text-gray-400 text-xs">
                  {t.closedDate ? new Date(t.closedDate).toLocaleDateString('es-CL') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
