import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { STATUS_LABEL, STATUS_COLOR, URGENCY_LABEL, type TicketStatusId, type TicketUrgencyId } from '@/lib/tickets/labels'

export const metadata = { title: 'Mis tickets — INGEGAR' }

const CLOSED = ['resuelto', 'cancelado', 'fusionado']

export default async function MisTicketsPage() {
  const actor = await requireActor(['tecnico'])

  const tickets = await prisma.ticket.findMany({
    where: { tenantId: actor.tenantId, assignedToId: actor.id, deletedAt: null },
    select: {
      id: true, ticketCode: true, title: true, status: true, urgency: true, createdAt: true,
      client: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const activos = tickets.filter(t => !CLOSED.includes(t.status))
  const cerrados = tickets.filter(t => CLOSED.includes(t.status))

  const Card = ({ t }: { t: (typeof tickets)[number] }) => (
    <Link
      href={`/mi-panel/tickets/${t.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-gray-500">{t.ticketCode}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[t.status as TicketStatusId] ?? 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABEL[t.status as TicketStatusId] ?? t.status}
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold text-ink">{t.title}</div>
      <div className="mt-1 text-xs text-gray-500">
        {t.client.name}{t.branch ? ` · ${t.branch.name}` : ''} · {URGENCY_LABEL[t.urgency as TicketUrgencyId] ?? t.urgency}
      </div>
    </Link>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Link href="/mi-panel" className="text-sm text-gray-400 transition hover:text-brand">← Mi panel</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-ink">Mis tickets</h1>
      </div>

      {activos.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No tienes tickets asignados activos.
        </p>
      ) : (
        <div className="space-y-3">{activos.map(t => <Card key={t.id} t={t} />)}</div>
      )}

      {cerrados.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-gray-500">
            Cerrados ({cerrados.length})
          </summary>
          <div className="mt-3 space-y-3 opacity-70">{cerrados.map(t => <Card key={t.id} t={t} />)}</div>
        </details>
      )}
    </div>
  )
}
