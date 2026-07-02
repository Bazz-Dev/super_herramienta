import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { getTickets } from '@/lib/tickets/tickets'
import { TicketListView } from '@/components/tickets/ticket-list-view'
import {
  STATUS_DOT, STATUS_LABEL,
  type TicketStatusId,
} from '@/lib/tickets/labels'

export const metadata = { title: 'Tickets — INGEGAR' }

export default async function TicketsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const actor = { id: session.user.id, tenantId: session.user.tenantId, role: session.user.role }

  const [tickets, clients, users] = await Promise.all([
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
  ])

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const needsAttention = tickets.filter(t => t.status === 'nuevo' && !t.assignedToId).length
  const emergencias    = tickets.filter(t => t.urgency === 'emergencia').length
  const sinAbordar24h  = tickets.filter(t =>
    t.status === 'nuevo' &&
    (nowMs - new Date(t.createdAt).getTime()) > 86_400_000,
  ).length

  // Serialize dates to ISO strings for client component
  const serialized = tickets.map(t => ({
    id: t.id,
    ticketCode: t.ticketCode,
    title: t.title,
    status: t.status,
    urgency: t.urgency,
    createdAt: t.createdAt.toISOString(),
    estimatedDate: t.estimatedDate ? t.estimatedDate.toISOString() : null,
    client: t.client,
    branch: t.branch ? { id: t.branch.id, name: t.branch.name } : null,
    assignedTo: t.assignedTo ? { id: t.assignedTo.id, name: t.assignedTo.name } : null,
    _count: t._count,
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Tickets de mantención</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">{tickets.length} activos</span>
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
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:opacity-90"
        >
          + Nuevo ticket
        </Link>
      </div>

      <TicketListView tickets={serialized} clients={clients} users={users} />

      {/* Closed tickets */}
      <ClosedSection actor={actor} />
    </div>
  )
}

async function ClosedSection({ actor }: { actor: { id: string; tenantId: string; role: string } }) {
  const closed = await prisma.ticket.findMany({
    where: {
      tenantId: actor.tenantId,
      status: { in: ['resuelto', 'cancelado'] },
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
      _count: { select: { documents: true } },
    },
    orderBy: { closedDate: 'desc' },
    take: 20,
  })

  if (closed.length === 0) return null

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Cerrados recientes</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
            <tr>
              {['Código', 'Título', 'Cliente', 'Sucursal', 'Estado', 'Técnico', 'Docs', 'Cierre'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {closed.map(t => (
              <tr key={t.id} className="transition hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link href={`/tickets/${t.id}`} className="font-mono text-xs text-gray-400 hover:text-brand">
                    {t.ticketCode}
                  </Link>
                </td>
                <td className="max-w-[240px] px-4 py-2.5">
                  <Link href={`/tickets/${t.id}`} className="line-clamp-1 text-gray-700 hover:text-brand">{t.title}</Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">{t.client.name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{t.branch?.name ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status as TicketStatusId] ?? 'bg-gray-400'}`} />
                    {STATUS_LABEL[t.status as TicketStatusId]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{t.assignedTo?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-center">
                  {t._count.documents > 0 ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-600">
                      📎 {t._count.documents}
                    </span>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-400">
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
