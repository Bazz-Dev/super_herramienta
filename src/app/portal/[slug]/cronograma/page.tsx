import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import { resolvePortalTheme } from '@/lib/portal-theme'

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Programado',
  in_progress: 'En ejecución',
  done: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: '#3b82f6',
  in_progress: '#f59e0b',
  done: '#22c55e',
  cancelled: '#9ca3af',
}

const TICKET_STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo',
  en_revision: 'En revisión',
  en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esperando aprobación',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
}

function fDate(d: string | Date) {
  return new Date(d).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function fTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export default async function PortalCronogramaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()

  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const isStaff = isStaffViewing(session)
  const theme = resolvePortalTheme(client.portalTheme)

  // All assignments for this client, ordered by date desc
  const assignments = await prisma.assignment.findMany({
    where: { clientId: client.id, status: { not: 'cancelled' } },
    include: {
      assignees: {
        include: { technician: { select: { name: true, specialty: true } } },
      },
      ticket: {
        select: { ticketCode: true, title: true, status: true, urgency: true, branch: { select: { name: true } } },
      },
    },
    orderBy: { start: 'desc' },
  })

  // Group by month
  type AssignmentRow = typeof assignments[number]
  const byMonth = new Map<string, AssignmentRow[]>()
  for (const a of assignments) {
    const key = new Date(a.start).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(a)
  }

  // KPIs
  const total = assignments.length
  const scheduled = assignments.filter(a => a.status === 'scheduled').length
  const inProgress = assignments.filter(a => a.status === 'in_progress').length
  const done = assignments.filter(a => a.status === 'done').length

  const userName = session?.user?.name ?? 'Usuario'

  return (
    <PortalShell
      slug={slug}
      clientName={client.name}
      userName={userName}
      primary={theme.primary}
      bg={theme.bg}
      cardBg={theme.card}
      textColor={theme.text}
      activeHref={`/portal/${slug}/cronograma`}
      topbarTitle="Cronograma"
      topbarSub={`Trabajos programados · ${client.name}`}
      isAdmin={isStaff}
    >
      <div className="pg">
        {/* KPIs */}
        <div className="pw-kpi" style={{ marginBottom: '20px' }}>
          {[
            { label: 'Total trabajos', value: total, color: theme.primary },
            { label: 'Programados', value: scheduled, color: '#3b82f6' },
            { label: 'En ejecución', value: inProgress, color: '#f59e0b' },
            { label: 'Completados', value: done, color: '#22c55e' },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <div className="kpi-val" style={{ color: k.color }}>{k.value}</div>
              <div className="kpi-lbl">{k.label}</div>
            </div>
          ))}
        </div>

        {assignments.length === 0 ? (
          <div className="pempty">
            <div className="pempty-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>
            </div>
            <p className="pempty-title">Sin trabajos programados</p>
            <p className="pempty-sub">Los trabajos asignados a tu empresa aparecerán aquí con su estado y técnicos asignados.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {Array.from(byMonth.entries()).map(([month, items]) => (
              <div key={month}>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--t3)' }}>{month}</span>
                  <span style={{ fontSize: '11px', background: 'var(--s3)', color: 'var(--t2)', borderRadius: '12px', padding: '1px 8px', fontWeight: '600' }}>{items.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map(a => {
                    const color = STATUS_COLOR[a.status] ?? '#9ca3af'
                    const techs = a.assignees.map(ae => ae.technician.name).join(', ')
                    return (
                      <div key={a.id} className="pcard" style={{ padding: '14px 18px', borderLeft: `3px solid ${color}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--tx)' }}>{a.title}</span>
                              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', background: `${color}18`, color, border: `1px solid ${color}40` }}>
                                {STATUS_LABEL[a.status]}
                              </span>
                            </div>

                            {/* Date + time */}
                            <p style={{ fontSize: '12px', color: 'var(--t2)', marginBottom: a.ticket ? '6px' : '0' }}>
                              📅 {fDate(a.start)} · {fTime(a.start)} – {fTime(a.end)}
                            </p>

                            {/* Linked ticket */}
                            {a.ticket && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', padding: '5px 10px', background: 'var(--s2)', borderRadius: '6px', border: '1px solid var(--bd)' }}>
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--t3)', fontWeight: '600' }}>{a.ticket.ticketCode}</span>
                                <span style={{ fontSize: '11px', color: 'var(--t2)' }}>{a.ticket.title}</span>
                                {a.ticket.branch && <span style={{ fontSize: '10px', color: 'var(--t3)' }}>· {a.ticket.branch.name}</span>}
                                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: '600', color: 'var(--t3)', textTransform: 'capitalize' }}>
                                  {TICKET_STATUS_LABEL[a.ticket.status] ?? a.ticket.status}
                                </span>
                              </div>
                            )}

                            {/* Technicians */}
                            {techs && (
                              <p style={{ fontSize: '11px', color: 'var(--t3)' }}>
                                🔧 {techs}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Meeting URL */}
                        {a.meetingUrl && (
                          <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '10px', fontSize: '12px', fontWeight: '600', color: theme.primary, textDecoration: 'none' }}>
                            🔗 Unirse a reunión →
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  )
}
