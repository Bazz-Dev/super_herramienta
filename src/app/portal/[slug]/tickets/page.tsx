import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTickets } from '@/lib/tickets/tickets'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import {
  PORTAL_STATUS_BADGE as SB,
  PORTAL_STATUS_SHORT as SL,
  PORTAL_URGENCY_BADGE as UB,
  PORTAL_URGENCY_SHORT as UL,
  PROGRESS_STEPS as STEPS,
  PROGRESS_STEPS_LABEL as SLBL,
} from '@/lib/tickets/labels'

// SVG icons
function IconEmpty() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="22" height="20" rx="3"/>
      <path d="M8 10h12M8 14h8M8 18h6"/>
    </svg>
  )
}
function IconArrowRight() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2.5l3.5 3.5L4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function IconPin() {
  return <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="4.5" r="2"/><path d="M5.5 6.5v4"/></svg>
}

const URGENCY_CARD: Record<string, string> = {
  emergencia: 'ticket-card-em', urgencia: 'ticket-card-ur',
  no_urgente: 'ticket-card-rq', preventivo: 'ticket-card-pr',
}

function stepState(status: string, i: number) {
  const si = STEPS.indexOf(status)
  if (si < 0) return ''
  if (i < si) return 'done'
  if (i === si) return 'current'
  return ''
}

export default async function PortalTicketsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const isStaff = isStaffViewing(session)
  const tickets = await getClientTickets(client.id)
  let theme = { primary: '#d42030', bg: '#f4f3f1', card: '#ffffff', text: '#18130e' }
  if (client.portalTheme) { try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {} }

  const open   = tickets.filter(t => !['resuelto', 'cancelado', 'fusionado'].includes(t.status))
  const closed = tickets.filter(t => ['resuelto', 'cancelado'].includes(t.status))
  const bySt   = tickets.reduce<Record<string, number>>((a, t) => { a[t.status] = (a[t.status] ?? 0) + 1; return a }, {})

  const btn = isStaff ? (
    <Link href="/tickets" style={{ textDecoration: 'none', fontSize: '12px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: '600' }}>
      ← Volver a INGEGAR
    </Link>
  ) : (
    <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ textDecoration: 'none', fontSize: '13px', padding: '8px 18px' }}>
      + Nueva solicitud
    </Link>
  )

  return (
    <PortalShell slug={slug} clientName={client.name}
      userName={session?.user?.name ?? 'Usuario'} primary={theme.primary}
      activeHref={`/portal/${slug}/tickets`} topbarTitle="Mis solicitudes"
      topbarSub={`${tickets.length} solicitudes · ${open.length} activas`} topbarRight={btn}>
      <div style={{ padding: '24px 28px' }}>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '28px' }}>
          {[
            { label: 'Activas', n: open.length, color: theme.primary },
            { label: 'En ejecución', n: bySt['en_ejecucion'] ?? 0, color: '#f59e0b' },
            { label: 'Resueltas', n: bySt['resuelto'] ?? 0, color: '#22c55e' },
            { label: 'Total', n: tickets.length, color: 'var(--p-t2)' },
          ].map(({ label, n, color }) => (
            <div key={label} className="pcard" style={{ padding: '16px 18px' }}>
              <p style={{ fontSize: '26px', fontWeight: '800', color, lineHeight: 1, marginBottom: '5px', fontVariantNumeric: 'tabular-nums' }}>{n}</p>
              <p style={{ fontSize: '11px', color: 'var(--p-t3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Active tickets */}
        {open.length === 0 ? (
          <div className="pcard" style={{ marginBottom: '24px' }}>
            <div className="pempty">
              <div className="pempty-icon"><IconEmpty /></div>
              <p className="pempty-title">Sin solicitudes activas</p>
              <p className="pempty-sub">Crea una nueva solicitud cuando necesites asistencia técnica.</p>
              {!isStaff && (
                <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ textDecoration: 'none', marginTop: '4px' }}>
                  + Crear solicitud
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '32px' }}>
            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.4px', color: 'var(--p-t3)', marginBottom: '10px' }}>
              Activas — {open.length}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {open.map(t => {
                const si = STEPS.indexOf(t.status)
                return (
                  <Link key={t.id} href={`/portal/${slug}/tickets/${t.id}`}
                    className={`pcard pcard-hover ${URGENCY_CARD[t.urgency] ?? ''}`}
                    style={{ display: 'block', padding: '16px 18px', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: si >= 0 ? '14px' : '0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                          <span className="mono" style={{ fontSize: '10px', color: 'var(--p-t3)' }}>{t.ticketCode}</span>
                          <span className={UB[t.urgency] ?? 'badge'}>{UL[t.urgency] ?? t.urgency}</span>
                          {t.branch && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--p-t3)' }}>
                              <IconPin />{t.branch.name}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{t.title}</p>
                        <p style={{ fontSize: '12px', color: 'var(--p-t3)' }}>
                          {t.assignedTo
                            ? <span>Técnico: <strong style={{ color: 'var(--p-t2)', fontWeight: '600' }}>{t.assignedTo.name}</strong></span>
                            : <span>Pendiente de asignación</span>}
                          {' · '}{new Date(t.createdAt).toLocaleDateString('es-CL')}
                        </p>
                      </div>
                      <span className={SB[t.status] ?? 'badge'} style={{ flexShrink: 0 }}>{SL[t.status] ?? t.status}</span>
                    </div>
                    {/* Mini stepper */}
                    {si >= 0 && (
                      <div className="psteps">
                        {STEPS.map((s, i) => {
                          const state = stepState(t.status, i)
                          return (
                            <div key={s} className={`pstep-wrap${state ? ' ' + state : ''}`}>
                              <div className="pstep-circle" style={{ width: '22px', height: '22px', fontSize: '10px' }}>
                                {i < si
                                  ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 5l2.5 2.5L8.5 2"/></svg>
                                  : <span>{i + 1}</span>}
                              </div>
                              <span className="pstep-label" style={{ fontSize: '9px' }}>{SLBL[i]}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Closed / history */}
        {closed.length > 0 && (
          <div>
            <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.4px', color: 'var(--p-t3)', marginBottom: '10px' }}>
              Historial — {closed.length}
            </p>
            <div className="pcard" style={{ overflow: 'hidden' }}>
              {closed.map((t, i) => (
                <div key={t.id}>
                  {i > 0 && <div className="pdivider" />}
                  <Link href={`/portal/${slug}/tickets/${t.id}`}
                    className="prow-link"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', textDecoration: 'none', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--p-t3)' }}>{t.ticketCode} · </span>
                      <span style={{ fontSize: '13px', color: 'var(--p-text)', fontWeight: '500' }}>{t.title}</span>
                      {t.branch && (
                        <span style={{ fontSize: '11px', color: 'var(--p-t3)', marginLeft: '8px' }}>· {t.branch.name}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {t.closedDate && <span style={{ fontSize: '11px', color: 'var(--p-t3)' }}>{new Date(t.closedDate).toLocaleDateString('es-CL')}</span>}
                      <span className={SB[t.status] ?? 'badge'}>{SL[t.status] ?? t.status}</span>
                      <IconArrowRight />
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  )
}
