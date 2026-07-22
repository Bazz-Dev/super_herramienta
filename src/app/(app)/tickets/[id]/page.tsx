import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { getTicket } from '@/lib/tickets/tickets'
import {
  STATUS_LABEL, STATUS_COLOR,
  URGENCY_LABEL, URGENCY_COLOR,
  type TicketStatusId, type TicketUrgencyId,
} from '@/lib/tickets/labels'
import { TicketControls } from '@/components/tickets/ticket-controls'
import { HistoryPanel } from '@/components/tickets/history-panel'

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // requireActor aplica "ver como" (viewas) — no usar session.user directo aquí
  const actor = await requireActor()

  const { id } = await params

  // getTicket() no depende de estas otras 5 (solo necesitan `id`/`actor`, ya
  // resueltos) — antes se esperaba getTicket() solo y recién después se
  // lanzaban las demás, sumando un round-trip completo contra Turso en vano.
  const [ticket, technicians, staffUsers, allInformes, ticketExpenses, originJobs] = await Promise.all([
    getTicket(actor, id),
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
    prisma.clientDocument.findMany({
      where: { tenantId: actor.tenantId, type: 'informe', ticketId: id },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.findMany({
      where: { ticketId: id, tenantId: actor.tenantId },
      include: { technician: { select: { name: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.job.findMany({
      where: { originTicketId: id, tenantId: actor.tenantId },
      select: { id: true, description: true, status: true, collectionStatus: true, netAmount: true, branch: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  if (!ticket) notFound()

  const linkedInformes = allInformes.map(d => ({
    id: d.id,
    title: d.title,
    createdAt: d.createdAt.toISOString(),
  }))

  const urgency = ticket.urgency as TicketUrgencyId
  const status = ticket.status as TicketStatusId

  const publicHistory = ticket.history.filter((h) => !h.isInternal)
  const internalHistory = ticket.history.filter((h) => h.isInternal)

  const crearTrabajoParams = new URLSearchParams({
    cliente: ticket.clientId,
    desc: ticket.title,
    quoteRef: ticket.ticketCode,
    ticketCode: ticket.ticketCode,
    ticketId: ticket.id,
  })
  if (ticket.branchId) crearTrabajoParams.set('sucursal', ticket.branchId)
  const crearTrabajoHref = `/flujo/trabajos/new?${crearTrabajoParams}`

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back */}
      <Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
        Volver a tickets
      </Link>

      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Client / branch / portal */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-gray-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                {ticket.client.name}
              </span>
              {ticket.branch && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 14S3.5 10.2 3.5 6.5a4.5 4.5 0 0 1 9 0C12.5 10.2 8 14 8 14z" stroke="currentColor" strokeWidth="1.5"/></svg>
                  {ticket.branch.name}{ticket.branch.city ? `, ${ticket.branch.city}` : ''}
                </span>
              )}
              {ticket.client.portalSlug && (
                <Link href={`/portal/${ticket.client.portalSlug}`} target="_blank" className="text-xs text-brand hover:underline">
                  Ver portal →
                </Link>
              )}
            </div>

            <p className="mb-1 font-mono text-xs text-gray-400">{ticket.ticketCode}</p>
            <h1 className="text-xl font-bold text-ink">{ticket.title}</h1>
            {ticket.description && <p className="mt-1 text-sm text-gray-600">{ticket.description}</p>}
            {ticket.clientComment && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <p className="mb-0.5 text-xs font-semibold text-blue-600">Comentario del cliente</p>
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
              <span className="rounded-full bg-gray-100 px-3 py-1 font-mono text-xs text-gray-600">
                OT: {ticket.otNumber}
              </span>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs sm:grid-cols-4">
          <div>
            <p className="text-gray-400">Creado por</p>
            <p className="font-medium text-gray-700">{ticket.createdBy.name}</p>
          </div>
          <div>
            <p className="text-gray-400">Asignado a</p>
            {ticket.assignedTo?.technician?.id ? (
              <Link
                href={`/recursos/tecnicos/${ticket.assignedTo.technician.id}`}
                className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
              >
                {ticket.assignedTo.name}
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h8M6 2l4 4-4 4"/></svg>
              </Link>
            ) : (
              <p className={`font-medium ${ticket.assignedTo ? 'text-gray-700' : 'text-amber-600'}`}>
                {ticket.assignedTo?.name ?? 'Sin asignar'}
              </p>
            )}
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
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="mb-1 text-xs font-semibold text-green-700">Resumen del trabajo</p>
            <p className="text-sm text-green-800">{ticket.workSummary}</p>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-3 border-t border-gray-100 pt-3 flex flex-wrap gap-4">
          <Link
            href={`/gastos?ticketRef=${ticket.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-medium"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
            Registrar gasto →
          </Link>
          {(actor.role === 'super' || actor.role === 'supervisor') && !(status === 'resuelto' && originJobs.length === 0) && (
            <Link
              href={crearTrabajoHref}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-ink hover:underline font-medium"
              title={originJobs.length > 0 ? `Ya hay ${originJobs.length} trabajo(s) vinculado(s) a este ticket — evita duplicar cobro` : undefined}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="12" height="10" rx="1.5"/><path d="M5 2v4M11 2v4M2 8h12"/></svg>
              Crear trabajo en Flujo →
              {originJobs.length > 0 && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  ⚠ ya hay {originJobs.length}
                </span>
              )}
            </Link>
          )}
        </div>

        {/* Paso natural al cerrar: el ticket recién resuelto todavía no tiene
            cobro asociado — se lo ofrecemos de inmediato en vez de dejarlo
            como un link chico entre otras acciones secundarias. */}
        {(actor.role === 'super' || actor.role === 'supervisor') && status === 'resuelto' && originJobs.length === 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-lg" aria-hidden>✅</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Ticket resuelto — registra el cobro</p>
                <p className="text-xs text-green-700">Crea el trabajo en Flujo de Caja para empezar a facturarlo.</p>
              </div>
            </div>
            <Link
              href={crearTrabajoHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
            >
              Crear trabajo en Flujo →
            </Link>
          </div>
        )}
      </div>

      {/* 2-col layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: controls */}
        <div className="space-y-5 lg:col-span-2">
          <TicketControls
            ticket={{
              id: ticket.id,
              status: ticket.status,
              otNumber: ticket.otNumber,
              otFileUrl: ticket.otFileUrl,
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
            linkedInformes={linkedInformes}
          />
        </div>

        {/* Right: history */}
        <div className="space-y-4">
          <HistoryPanel events={publicHistory} title="Historial de actividad" variant="public" />
          {internalHistory.length > 0 && (
            <HistoryPanel events={internalHistory} title="Notas internas" variant="internal" />
          )}
        </div>
      </div>

      {/* Jobs originated from this ticket */}
      {originJobs.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Trabajos en Flujo de Caja</h2>
            <span className="text-xs text-gray-400">{originJobs.length} trabajo{originJobs.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {originJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">{j.description}</p>
                  <p className="text-xs text-gray-400">{j.branch.name}</p>
                </div>
                <Link
                  href={`/flujo/trabajos/${j.id}`}
                  className="ml-3 shrink-0 text-xs font-semibold text-brand hover:underline"
                >
                  Ver trabajo →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expenses linked to this ticket */}
      {ticketExpenses.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Gastos asociados</h2>
            <span className="text-xs text-gray-400">
              Total: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(
                ticketExpenses.filter(e => e.status === 'aprobado').reduce((s, e) => s + e.amount, 0)
              )} aprobado
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {ticketExpenses.map(e => {
              const CAT: Record<string, string> = {
                combustible: 'Combustible', estacionamiento: 'Estacionamiento',
                materiales: 'Materiales', viatico: 'Viático', herramienta: 'Herramienta', otro: 'Otro',
              }
              const STATUS_CLS: Record<string, string> = {
                pendiente: 'bg-amber-50 text-amber-700',
                aprobado: 'bg-green-50 text-green-700',
                rechazado: 'bg-red-50 text-red-600',
              }
              const STATUS_LBL: Record<string, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' }
              return (
                <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800">{CAT[e.category] ?? e.category}</p>
                    <p className="text-xs text-gray-400">
                      {e.technician.name} · {new Date(e.date).toLocaleDateString('es-CL')}
                      {e.description && ` · ${e.description}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLS[e.status] ?? ''}`}>
                      {STATUS_LBL[e.status] ?? e.status}
                    </span>
                    <span className="tabular-nums font-semibold text-gray-700">
                      {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(e.amount)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
