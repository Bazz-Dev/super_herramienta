import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTicket } from '@/lib/tickets/tickets'
import { STATUS_LABEL, STATUS_COLOR, URGENCY_LABEL, URGENCY_COLOR, STATUS_DOT, type TicketStatusId, type TicketUrgencyId } from '@/lib/tickets/labels'

export default async function PortalTicketDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const session = await auth()

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()

  if (!session?.user || session.user.role !== 'client' || session.user.clientId !== client.id) {
    redirect(`/portal/${slug}`)
  }

  const ticket = await getClientTicket(client.id, id)
  if (!ticket) notFound()

  let theme = { primary: '#f5b100', card: '#ffffff', text: '#111111', bg: '#f9fafb' }
  if (client.portalTheme) {
    try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {}
  }

  const status  = ticket.status as TicketStatusId
  const urgency = ticket.urgency as TicketUrgencyId

  return (
    <div className="min-h-screen" style={{ background: theme.bg }}>
      <header className="border-b px-6 py-4" style={{ background: theme.card, borderColor: `${theme.text}20` }}>
        <Link href={`/portal/${slug}/tickets`} className="text-sm opacity-60 hover:opacity-100 transition" style={{ color: theme.text }}>
          ← Mis solicitudes
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs opacity-40" style={{ color: theme.text }}>{ticket.ticketCode}</p>
            <h1 className="text-lg font-bold" style={{ color: theme.text }}>{ticket.title}</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        {/* Info card */}
        <div className="rounded-xl p-5 shadow-sm" style={{ background: theme.card }}>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs opacity-50 mb-0.5" style={{ color: theme.text }}>Sucursal</p>
              <p className="font-medium" style={{ color: theme.text }}>{ticket.branch?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs opacity-50 mb-0.5" style={{ color: theme.text }}>Urgencia</p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${URGENCY_COLOR[urgency]}`}>{URGENCY_LABEL[urgency]}</span>
            </div>
            <div>
              <p className="text-xs opacity-50 mb-0.5" style={{ color: theme.text }}>Técnico asignado</p>
              <p className="font-medium" style={{ color: theme.text }}>{ticket.assignedTo?.name ?? 'En revisión'}</p>
            </div>
            <div>
              <p className="text-xs opacity-50 mb-0.5" style={{ color: theme.text }}>Fecha de creación</p>
              <p className="font-medium" style={{ color: theme.text }}>{new Date(ticket.createdAt).toLocaleDateString('es-CL')}</p>
            </div>
          </div>

          {ticket.description && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: `${theme.text}15` }}>
              <p className="text-xs opacity-50 mb-1" style={{ color: theme.text }}>Descripción</p>
              <p className="text-sm" style={{ color: theme.text }}>{ticket.description}</p>
            </div>
          )}

          {ticket.workSummary && (
            <div className="mt-4 rounded-lg p-3" style={{ background: `${theme.primary}20` }}>
              <p className="text-xs font-semibold mb-1" style={{ color: theme.primary }}>Resumen del trabajo realizado</p>
              <p className="text-sm" style={{ color: theme.text }}>{ticket.workSummary}</p>
            </div>
          )}
        </div>

        {/* Items */}
        {ticket.items.length > 0 && (
          <div className="rounded-xl p-5 shadow-sm" style={{ background: theme.card }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: theme.text }}>
              Trabajos a realizar ({ticket.items.filter(i => i.status === 'resuelto').length}/{ticket.items.length} completados)
            </h2>
            <ul className="space-y-2">
              {ticket.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <span className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${item.status === 'resuelto' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}>
                    {item.status === 'resuelto' && '✓'}
                  </span>
                  <span className={item.status === 'resuelto' ? 'line-through opacity-40' : ''} style={{ color: theme.text }}>
                    {item.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Documents */}
        {ticket.documents.length > 0 && (
          <div className="rounded-xl p-5 shadow-sm" style={{ background: theme.card }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: theme.text }}>Documentos</h2>
            <ul className="space-y-2">
              {ticket.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="opacity-70" style={{ color: theme.text }}>📎 {doc.name}</span>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-medium hover:underline" style={{ color: theme.primary }}>
                    Descargar ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* History */}
        <div className="rounded-xl p-5 shadow-sm" style={{ background: theme.card }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: theme.text }}>Historial</h2>
          {ticket.history.length === 0 && (
            <p className="text-xs opacity-40" style={{ color: theme.text }}>Sin actividad aún.</p>
          )}
          <ul className="space-y-3">
            {ticket.history.map((h) => (
              <li key={h.id} className="relative pl-4 text-xs">
                <span className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${h.toStatus ? STATUS_DOT[h.toStatus as TicketStatusId] ?? 'bg-gray-300' : 'bg-gray-300'}`} />
                {h.note && <p style={{ color: theme.text }}>{h.note}</p>}
                {h.fromStatus && h.toStatus && (
                  <p className="opacity-50" style={{ color: theme.text }}>
                    {STATUS_LABEL[h.fromStatus as TicketStatusId] ?? h.fromStatus} → {STATUS_LABEL[h.toStatus as TicketStatusId] ?? h.toStatus}
                  </p>
                )}
                <p className="opacity-40" style={{ color: theme.text }}>
                  {new Date(h.createdAt).toLocaleString('es-CL')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  )
}
