import { notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTicket } from '@/lib/tickets/tickets'
import {
  STATUS_LABEL, STATUS_COLOR, STATUS_DOT,
  URGENCY_LABEL, URGENCY_COLOR,
  type TicketStatusId, type TicketUrgencyId,
} from '@/lib/tickets/labels'
import { TicketControls } from '@/components/tickets/ticket-controls'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const actor = { tenantId: session.user.tenantId, role: session.user.role, id: session.user.id! }

  const { id } = await params
  const ticket = await getTicket(actor, id)
  if (!ticket) notFound()

  const [technicians, staffUsers] = await Promise.all([
    prisma.technician.findMany({
      where: { tenantId: actor.tenantId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { tenantId: actor.tenantId, role: { in: ['super', 'supervisor'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const urgency = ticket.urgency as TicketUrgencyId
  const status = ticket.status as TicketStatusId

  const publicHistory = ticket.history.filter((h) => !h.isInternal)
  const internalHistory = ticket.history.filter((h) => h.isInternal)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Link href="/tickets" className="text-sm text-gray-500 hover:text-ink transition">← Volver a tickets</Link>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Client chip */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="rounded-full bg-gray-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                {ticket.client.name}
              </span>
              {ticket.branch && (
                <span className="text-xs text-gray-500">📍 {ticket.branch.name}{ticket.branch.city ? `, ${ticket.branch.city}` : ''}</span>
              )}
              {ticket.client.portalSlug && (
                <Link
                  href={`/portal/${ticket.client.portalSlug}`}
                  target="_blank"
                  className="text-xs text-brand hover:underline"
                >
                  Ver portal →
                </Link>
              )}
            </div>

            <p className="font-mono text-xs text-gray-400 mb-1">{ticket.ticketCode}</p>
            <h1 className="text-xl font-bold text-ink">{ticket.title}</h1>
            {ticket.description && <p className="mt-1 text-sm text-gray-600">{ticket.description}</p>}
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${URGENCY_COLOR[urgency]}`}>
              {URGENCY_LABEL[urgency]}
            </span>
            {ticket.otNumber && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-mono text-gray-600">
                OT: {ticket.otNumber}
              </span>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4 text-xs">
          <div>
            <p className="text-gray-400">Creado por</p>
            <p className="font-medium text-gray-700">{ticket.createdBy.name}</p>
          </div>
          <div>
            <p className="text-gray-400">Asignado a</p>
            <p className={`font-medium ${ticket.assignedTo ? 'text-gray-700' : 'text-amber-600'}`}>
              {ticket.assignedTo?.name ?? 'Sin asignar'}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Fecha estimada</p>
            <p className="font-medium text-gray-700">
              {ticket.estimatedDate ? new Date(ticket.estimatedDate).toLocaleDateString('es-CL') : '—'}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Carpeta Drive</p>
            {ticket.driveFolderUrl ? (
              <a href={ticket.driveFolderUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                Abrir en Drive ↗
              </a>
            ) : (
              <p className="text-gray-400">—</p>
            )}
          </div>
        </div>

        {ticket.workSummary && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3">
            <p className="text-xs font-semibold text-green-700 mb-1">Resumen del trabajo</p>
            <p className="text-sm text-green-800">{ticket.workSummary}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: controls */}
        <div className="lg:col-span-2 space-y-5">
          <TicketControls
            ticket={{
              id: ticket.id,
              status: ticket.status,
              otNumber: ticket.otNumber,
              assignedToId: ticket.assignedToId,
              estimatedDate: ticket.estimatedDate?.toISOString().split('T')[0] ?? null,
              workSummary: ticket.workSummary,
              internalNotes: ticket.internalNotes,
              driveFolderUrl: ticket.driveFolderUrl,
              showToClient: ticket.showToClient,
              items: ticket.items,
              documents: ticket.documents,
            }}
            staffUsers={staffUsers}
            technicians={technicians}
          />
        </div>

        {/* Right: history */}
        <div className="space-y-4">
          {/* Public history */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Historial</h3>
            {publicHistory.length === 0 && (
              <p className="text-xs text-gray-400">Sin actividad registrada.</p>
            )}
            <ul className="space-y-3">
              {publicHistory.map((h) => (
                <li key={h.id} className="relative pl-4 text-xs">
                  <span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${h.toStatus ? STATUS_DOT[h.toStatus as TicketStatusId] ?? 'bg-gray-300' : 'bg-gray-300'}`} />
                  <p className="text-gray-600">{h.note}</p>
                  {h.fromStatus && h.toStatus && (
                    <p className="text-gray-400">{STATUS_LABEL[h.fromStatus as TicketStatusId] ?? h.fromStatus} → {STATUS_LABEL[h.toStatus as TicketStatusId] ?? h.toStatus}</p>
                  )}
                  <p className="text-gray-400">{h.user?.name} · {new Date(h.createdAt).toLocaleString('es-CL')}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Internal notes */}
          {internalHistory.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-amber-800">Notas internas</h3>
              <ul className="space-y-3">
                {internalHistory.map((h) => (
                  <li key={h.id} className="text-xs">
                    <p className="text-amber-900">{h.note}</p>
                    <p className="text-amber-600">{h.user?.name} · {new Date(h.createdAt).toLocaleString('es-CL')}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
