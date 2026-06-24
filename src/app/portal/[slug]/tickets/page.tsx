import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTickets } from '@/lib/tickets/tickets'
import { STATUS_LABEL, STATUS_COLOR, URGENCY_LABEL, URGENCY_COLOR, type TicketStatusId, type TicketUrgencyId } from '@/lib/tickets/labels'

export default async function PortalTicketsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()

  if (!session?.user || session.user.role !== 'client' || session.user.clientId !== client.id) {
    redirect(`/portal/${slug}`)
  }

  const tickets = await getClientTickets(client.id)

  let theme = { primary: '#f5b100', card: '#ffffff', text: '#111111', bg: '#f9fafb' }
  if (client.portalTheme) {
    try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {}
  }

  const open   = tickets.filter((t) => !['resuelto', 'cancelado'].includes(t.status))
  const closed = tickets.filter((t) => ['resuelto', 'cancelado'].includes(t.status))

  return (
    <div className="min-h-screen" style={{ background: theme.bg }}>
      {/* Portal header */}
      <header className="border-b px-6 py-4 flex items-center justify-between" style={{ background: theme.card, borderColor: `${theme.text}20` }}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black" style={{ background: theme.primary, color: '#111' }}>
            {client.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: theme.text }}>{client.name}</p>
            <p className="text-xs opacity-50" style={{ color: theme.text }}>Portal de mantención</p>
          </div>
        </div>
        <Link
          href={`/portal/${slug}/tickets/new`}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          style={{ background: theme.primary, color: '#111' }}
        >
          + Nueva solicitud
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Open tickets */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 opacity-60" style={{ color: theme.text }}>
            Solicitudes activas ({open.length})
          </h2>
          {open.length === 0 && (
            <div className="rounded-xl border-2 border-dashed p-8 text-center opacity-40" style={{ borderColor: theme.text, color: theme.text }}>
              <p className="text-sm">No tienes solicitudes activas.</p>
              <Link href={`/portal/${slug}/tickets/new`} className="mt-2 inline-block text-sm font-semibold underline">
                Crear primera solicitud
              </Link>
            </div>
          )}
          <div className="space-y-3">
            {open.map((t) => (
              <Link key={t.id} href={`/portal/${slug}/tickets/${t.id}`}
                className="block rounded-xl p-4 shadow-sm transition hover:shadow-md"
                style={{ background: theme.card }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs opacity-40 mb-0.5" style={{ color: theme.text }}>{t.ticketCode}</p>
                    <p className="font-semibold text-sm truncate" style={{ color: theme.text }}>{t.title}</p>
                    {t.branch && <p className="text-xs opacity-50 mt-0.5" style={{ color: theme.text }}>📍 {t.branch.name}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[t.status as TicketStatusId]}`}>
                      {STATUS_LABEL[t.status as TicketStatusId]}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${URGENCY_COLOR[t.urgency as TicketUrgencyId]}`}>
                      {URGENCY_LABEL[t.urgency as TicketUrgencyId]}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs opacity-40" style={{ color: theme.text }}>
                  <span>{t.assignedTo ? `Técnico: ${t.assignedTo.name}` : 'En revisión'}</span>
                  <span>{new Date(t.createdAt).toLocaleDateString('es-CL')}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Closed tickets */}
        {closed.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 opacity-40" style={{ color: theme.text }}>
              Historial ({closed.length})
            </h2>
            <div className="space-y-2">
              {closed.map((t) => (
                <Link key={t.id} href={`/portal/${slug}/tickets/${t.id}`}
                  className="flex items-center justify-between rounded-lg px-4 py-3 transition hover:opacity-80"
                  style={{ background: theme.card, opacity: 0.7 }}
                >
                  <div>
                    <p className="font-mono text-xs opacity-40" style={{ color: theme.text }}>{t.ticketCode}</p>
                    <p className="text-sm" style={{ color: theme.text }}>{t.title}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[t.status as TicketStatusId]}`}>
                    {STATUS_LABEL[t.status as TicketStatusId]}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
