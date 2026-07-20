import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { STATUS_LABEL, STATUS_COLOR, URGENCY_LABEL, type TicketStatusId, type TicketUrgencyId } from '@/lib/tickets/labels'
import { TecnicoTicketActions } from '@/components/tickets/tecnico-ticket-actions'
import { HistoryPanel } from '@/components/tickets/history-panel'

export const metadata = { title: 'Ticket — INGEGAR' }

export default async function TecnicoTicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(['tecnico'])
  const { id } = await params

  // Server-side: el técnico SOLO ve tickets asignados a él, de su tenant
  const ticket = await prisma.ticket.findFirst({
    where: { id, tenantId: actor.tenantId, assignedToId: actor.effectiveId, deletedAt: null },
    select: {
      id: true, ticketCode: true, title: true, description: true, status: true,
      urgency: true, category: true, otNumber: true, estimatedDate: true, createdAt: true,
      client: { select: { name: true } },
      branch: { select: { name: true } },
      history: {
        // Igual que el portal (getClientTicket): las notas internas son solo
        // para staff, el técnico no ve la app interna y tampoco debería verlas.
        where: { isInternal: false },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, note: true, fromStatus: true, toStatus: true, isInternal: true, createdAt: true, user: { select: { id: true, name: true } } },
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
      <HistoryPanel events={ticket.history} title="Historial" variant="public" />
    </div>
  )
}
