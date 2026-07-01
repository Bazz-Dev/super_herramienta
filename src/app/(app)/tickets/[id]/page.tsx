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
      where: { tenantId: actor.tenantId, role: { in: ['super', 'supervisor', 'tecnico'] }, active: true },
      select: { id: true, name: true, role: true },
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
            {ticket.clientComment && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="text-xs font-semibold text-blue-600 mb-0.5">Comentario del cliente</p>
                <p className="text-sm text-blue-800">{ticket.clientComment}</p>
              </div>
            )}
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
            <p className="text-gray-400">Adjuntos</p>
            <p className="font-medium text-gray-700">
              {ticket.documents.length > 0
                ? `${ticket.documents.length} archivo${ticket.documents.length > 1 ? 's' : ''}`
                : '—'}
            </p>
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
              folderKey: ticket.folderKey,
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
            <h3 className="mb-4 text-sm font-semibold text-gray-700 flex items-center justify-between">
              Historial de actividad
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{publicHistory.length}</span>
            </h3>
            {publicHistory.length === 0 ? (
              <p className="text-xs text-gray-400">Sin actividad registrada.</p>
            ) : (
              <ol className="relative border-l border-gray-100 ml-2 space-y-0">
                {publicHistory.map((h, i) => {
                  const isStatusChange = !!(h.fromStatus && h.toStatus)
                  const actor = h.user?.name ?? 'Sistema'
                  const dateStr = new Date(h.createdAt).toLocaleString('es-CL', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                  const dotCls = h.toStatus
                    ? STATUS_DOT[h.toStatus as TicketStatusId] ?? 'bg-gray-300'
                    : 'bg-gray-300'
                  return (
                    <li key={h.id} className={`ml-4 ${i < publicHistory.length - 1 ? 'pb-5' : 'pb-1'}`}>
                      <span className={`absolute -left-1.25 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ring-white ${dotCls}`} />
                      <div className="text-xs">
                        {isStatusChange && (
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                              {STATUS_LABEL[h.fromStatus as TicketStatusId] ?? h.fromStatus}
                            </span>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 shrink-0"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${STATUS_COLOR[h.toStatus as TicketStatusId] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                              {STATUS_LABEL[h.toStatus as TicketStatusId] ?? h.toStatus}
                            </span>
                          </div>
                        )}
                        {h.note && <p className="text-gray-700 mb-0.5">{h.note}</p>}
                        <p className="text-gray-400">
                          <span className="font-medium text-gray-500">{actor}</span>
                          {' · '}{dateStr}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          {/* Internal notes */}
          {internalHistory.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-amber-800 flex items-center justify-between">
                🔒 Notas internas
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">{internalHistory.length}</span>
              </h3>
              <ol className="relative border-l border-amber-200 ml-2 space-y-0">
                {internalHistory.map((h, i) => (
                  <li key={h.id} className={`ml-4 ${i < internalHistory.length - 1 ? 'pb-4' : 'pb-1'}`}>
                    <span className="absolute -left-1.25 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-amber-50" />
                    <div className="text-xs">
                      {h.note && <p className="text-amber-900 mb-0.5">{h.note}</p>}
                      <p className="text-amber-600">
                        <span className="font-medium">{h.user?.name ?? 'Sistema'}</span>
                        {' · '}{new Date(h.createdAt).toLocaleString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
