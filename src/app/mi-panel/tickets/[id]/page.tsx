import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { STATUS_LABEL, STATUS_COLOR, URGENCY_LABEL, type TicketStatusId, type TicketUrgencyId } from '@/lib/tickets/labels'
import { TecnicoTicketActions } from '@/components/tickets/tecnico-ticket-actions'

export const metadata = { title: 'Ticket — INGEGAR' }

function fDate(d: Date | string) {
  return new Date(d).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function TecnicoTicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(['tecnico'])
  const { id } = await params

  // Server-side: el técnico SOLO ve tickets asignados a él, de su tenant
  const ticket = await prisma.ticket.findFirst({
    where: { id, tenantId: actor.tenantId, assignedToId: actor.id, deletedAt: null },
    select: {
      id: true, ticketCode: true, title: true, description: true, status: true,
      urgency: true, category: true, otNumber: true, estimatedDate: true, createdAt: true,
      client: { select: { name: true } },
      branch: { select: { name: true } },
      history: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, note: true, fromStatus: true, toStatus: true, isInternal: true, createdAt: true, user: { select: { name: true } } },
      },
      documents: {
        orderBy: { uploadedAt: 'desc' },
        select: { id: true, name: true, fileUrl: true, mimeType: true },
      },
    },
  })
  if (!ticket) redirect('/mi-panel/tickets')

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link href="/mi-panel/tickets" className="text-sm text-gray-400 transition hover:text-brand">← Mis tickets</Link>
      </div>

      {/* Cabecera */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-gray-500">{ticket.ticketCode}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[ticket.status as TicketStatusId] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[ticket.status as TicketStatusId] ?? ticket.status}
          </span>
        </div>
        <h1 className="mt-1 text-lg font-bold text-ink">{ticket.title}</h1>
        <div className="mt-1 text-xs text-gray-500">
          {ticket.client.name}{ticket.branch ? ` · ${ticket.branch.name}` : ''} ·{' '}
          {URGENCY_LABEL[ticket.urgency as TicketUrgencyId] ?? ticket.urgency}
          {ticket.otNumber ? ` · OT ${ticket.otNumber}` : ''}
        </div>
        {ticket.description && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{ticket.description}</p>}
      </div>

      {/* Acciones del técnico: estado permitido + comentario + evidencia */}
      <TecnicoTicketActions
        ticketId={ticket.id}
        status={ticket.status}
        documents={ticket.documents}
      />

      {/* Historial */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Historial</h2>
        {ticket.history.length === 0 ? (
          <p className="text-sm text-gray-400">Sin registros.</p>
        ) : (
          <ul className="space-y-3">
            {ticket.history.map(h => (
              <li key={h.id} className="border-l-2 border-gray-200 pl-3 text-sm">
                <div className="text-xs text-gray-400">
                  {fDate(h.createdAt)} · {h.user?.name ?? '—'}
                  {h.isInternal && <span className="ml-1 rounded bg-gray-100 px-1 text-[10px]">interna</span>}
                </div>
                {h.fromStatus && h.toStatus && (
                  <div className="text-xs text-gray-500">
                    {STATUS_LABEL[h.fromStatus as TicketStatusId] ?? h.fromStatus} → {STATUS_LABEL[h.toStatus as TicketStatusId] ?? h.toStatus}
                  </div>
                )}
                {h.note && <div className="text-gray-700">{h.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
