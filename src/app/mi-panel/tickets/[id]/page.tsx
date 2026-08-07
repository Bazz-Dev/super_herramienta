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
      urgency: true, category: true, otNumber: true, otFileUrl: true, estimatedDate: true, createdAt: true,
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
        select: { id: true, name: true, fileUrl: true, mimeType: true, itemId: true },
      },
      // Requerimientos (FASE 2): el técnico ve el detalle de cada problema
      // reportado (categoría/título/descripción/comentario) para saber qué
      // hacer -- nunca costos, que ni siquiera vive en este modelo (vive en
      // Job, fuera de esta query).
      items: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, description: true, category: true, comment: true, status: true },
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

      {/* Requerimientos — cuando el ticket agrupa varios problemas (FASE 2),
          cada uno con su propio detalle. Solo lectura acá; nunca se muestra
          costo (no existe en este modelo, vive en Job). */}
      {ticket.items.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Requerimientos ({ticket.items.length})</h3>
          <ul className="space-y-3">
            {ticket.items.map(item => {
              const fileCount = ticket.documents.filter(d => d.itemId === item.id).length
              return (
                <li key={item.id} className="text-sm">
                  <p className="font-medium text-gray-700">
                    {item.category && <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">{item.category}</span>}
                    {item.title}
                  </p>
                  {item.description && <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>}
                  {item.comment && <p className="mt-0.5 text-xs italic text-gray-400">&quot;{item.comment}&quot;</p>}
                  {fileCount > 0 && <p className="mt-0.5 text-xs text-gray-400">📎 {fileCount} archivo{fileCount !== 1 ? 's' : ''}</p>}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Acciones del técnico: estado permitido + comentario + evidencia + OT */}
      <TecnicoTicketActions
        ticketId={ticket.id}
        status={ticket.status}
        documents={ticket.documents}
        otFileUrl={ticket.otFileUrl}
      />

      {/* Historial */}
      <HistoryPanel events={ticket.history} title="Historial" variant="public" />
    </div>
  )
}
