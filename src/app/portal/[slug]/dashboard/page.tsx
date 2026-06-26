import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTickets } from '@/lib/tickets/tickets'
import { canViewPortal } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import {
  PORTAL_STATUS_BADGE as SB,
  PORTAL_STATUS_SHORT as SL,
  PORTAL_URGENCY_BADGE as UB,
  PORTAL_URGENCY_SHORT as UL,
} from '@/lib/tickets/labels'

const OPEN_STATUSES = ['nuevo', 'en_revision', 'en_ejecucion', 'esperando_aprobacion', 'bloqueado']
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const URGENCY_COLOR: Record<string, string> = {
  emergencia: '#ef4444', urgencia: '#f59e0b', no_urgente: '#22c55e', preventivo: '#3b82f6',
}

function localYearMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function daysBetween(dateStr: string) {
  const now = new Date()
  const d = new Date(dateStr)
  return Math.floor((d.getTime() - now.getTime()) / 86400000)
}

function getMonthly(tickets: Ticket[]) {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = MONTHS[d.getMonth()]
    let active = 0, resolved = 0
    tickets.forEach(t => {
      const tc = String(t.createdAt).substring(0, 7)
      if (tc !== key) return
      if (['resuelto','cancelado'].includes(t.status)) resolved++
      else active++
    })
    return { key, label, active, resolved, total: active + resolved }
  })
}

type Ticket = Awaited<ReturnType<typeof getClientTickets>>[number]

function BarChart({ months }: { months: ReturnType<typeof getMonthly> }) {
  const W = 480, H = 100, PL = 24, PR = 8, PT = 12, PB = 22, GH = H - PT - PB
  const maxV = Math.max(...months.map(m => m.total), 1)
  const bW = Math.floor((W - PL - PR) / months.length)
  const lines = [0, 1, 2, 3, 4].map(g => {
    const y = PT + GH * (1 - g / 4)
    return (
      <g key={g}>
        <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="var(--p-bd)" strokeWidth="1" strokeDasharray={g ? '3,3' : ''} />
        {g > 0 && <text x={PL - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--p-t3)" fontFamily="Inter,sans-serif">{Math.round(maxV * g / 4)}</text>}
      </g>
    )
  })
  const bars = months.map((m, i) => {
    const x = PL + i * bW + bW * 0.12
    const bw = bW * 0.76
    const rh = m.resolved ? Math.max((m.resolved / maxV) * GH, 2) : 0
    const ah = m.active ? Math.max((m.active / maxV) * GH, 2) : 0
    return (
      <g key={m.key}>
        {rh > 0 && <rect x={x} y={H - PB - rh - ah} width={bw} height={rh} fill="#22c55e" rx="2" opacity=".75" />}
        {ah > 0 && <rect x={x} y={H - PB - ah} width={bw} height={ah} fill="var(--p-acc)" rx="2" />}
        {m.total === 0 && <rect x={x} y={H - PB - 2} width={bw} height={2} fill="var(--p-bd)" rx="1" />}
        {m.total > 0 && <text x={x + bw / 2} y={H - PB - (m.total / maxV) * GH - 3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--p-t2)" fontFamily="Inter,sans-serif">{m.total}</text>}
        <text x={x + bw / 2} y={H - PB + 13} textAnchor="middle" fontSize="9" fill="var(--p-t3)" fontFamily="Inter,sans-serif">{m.label}</text>
      </g>
    )
  })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {lines}{bars}
    </svg>
  )
}

export default async function PortalDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const tickets = await getClientTickets(client.id)
  let theme = { primary: '#d42030', bg: '#f4f3f1', card: '#ffffff', text: '#18130e' }
  if (client.portalTheme) { try { theme = { ...theme, ...JSON.parse(client.portalTheme) } } catch {} }

  const act  = tickets.filter(t => OPEN_STATUSES.includes(t.status))
  const inProc = act.filter(t => !['nuevo'].includes(t.status))
  const vnc  = act.filter(t => t.estimatedDate && daysBetween(String(t.estimatedDate)) < 0)
  const mes  = localYearMonth()
  const resMes = tickets.filter(t => t.status === 'resuelto' && t.closedDate && String(t.closedDate).startsWith(mes))
  const months = getMonthly(tickets)
  const nombre = (session?.user?.name ?? 'Cliente').split(' ')[0]
  const hoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
  const btnNuevo = (
    <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ textDecoration: 'none', fontSize: '13px', padding: '8px 18px' }}>
      + Nueva solicitud
    </Link>
  )

  // Branch distribution
  const byBranch = act.reduce<Record<string, number>>((acc, t) => {
    const name = t.branch?.name ?? 'Sin sucursal'
    acc[name] = (acc[name] ?? 0) + 1
    return acc
  }, {})
  const branchList = Object.entries(byBranch).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxBranch = Math.max(...branchList.map(b => b[1]), 1)

  return (
    <PortalShell slug={slug} clientName={client.name} userName={session!.user.name ?? 'Usuario'}
      primary={theme.primary} activeHref={`/portal/${slug}/dashboard`}
      topbarTitle="Panel" topbarSub={`${tickets.length} solicitudes · ${act.length} activas`} topbarRight={btnNuevo}>
      <div style={{ padding: '20px 28px' }}>

        {/* Greeting */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--p-text)', letterSpacing: '-0.3px' }}>
            Hola, {nombre} 👋
          </div>
          <div style={{ fontSize: '12px', color: 'var(--p-t3)', marginTop: '2px', textTransform: 'capitalize' }}>{hoy}</div>
        </div>

        {/* Alerts */}
        {vnc.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--p-r2)', padding: '10px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.5 13H1.5L8 2z" fill="#ef4444"/><path d="M8 6.5v3M8 11.5v.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#b91c1c' }}>
              <strong>{vnc.length} requerimiento{vnc.length > 1 ? 's' : ''}</strong> fuera de plazo. Revisar fechas estimadas.
            </span>
            <Link href={`/portal/${slug}/tickets`} style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: '700', color: theme.primary, textDecoration: 'none', flexShrink: 0 }}>Ver →</Link>
          </div>
        )}

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Activos',        n: act.length,     color: theme.primary,   sub: 'en trámite' },
            { label: 'En proceso',     n: inProc.length,  color: '#3b82f6',        sub: 'INGEGAR trabajando' },
            { label: 'Resueltos mes',  n: resMes.length,  color: '#22c55e',        sub: 'este mes' },
            { label: 'Vencidos',       n: vnc.length,     color: vnc.length ? '#ef4444' : '#22c55e', sub: vnc.length ? 'Atención' : 'Al día' },
          ].map(({ label, n, color, sub }) => (
            <div key={label} className="pcard" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color, lineHeight: 1, marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-text)', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '10px', color: 'var(--p-t3)' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* Main 2-col layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '14px', alignItems: 'start' }}>

          {/* Left: chart + active list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Bar chart */}
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--p-text)' }}>Solicitudes por mes</div>
                  <div style={{ fontSize: '11px', color: 'var(--p-t3)' }}>Últimos 6 meses</div>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'var(--p-t3)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: theme.primary, display: 'inline-block' }} />Activos
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#22c55e', display: 'inline-block' }} />Resueltos
                  </span>
                </div>
              </div>
              <BarChart months={months} />
            </div>

            {/* Active tickets */}
            <div className="pcard" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 12px', borderBottom: '1px solid var(--p-bd)' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--p-text)' }}>Requerimientos activos</div>
                <Link href={`/portal/${slug}/tickets`} style={{ fontSize: '12px', fontWeight: '600', color: theme.primary, textDecoration: 'none' }}>Ver todos →</Link>
              </div>
              {act.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--p-t3)', fontSize: '13px' }}>
                  Sin requerimientos activos.{' '}
                  <Link href={`/portal/${slug}/tickets/new`} style={{ color: theme.primary, fontWeight: '600' }}>Crear uno →</Link>
                </div>
              ) : (
                act.map((t, i) => (
                  <Link key={t.id} href={`/portal/${slug}/tickets/${t.id}`}
                    style={{
                      display: 'grid', gridTemplateColumns: '3px 1fr auto',
                      alignItems: 'center', gap: '12px', padding: '11px 18px',
                      borderBottom: i < act.length - 1 ? '1px solid var(--p-bd)' : 'none',
                      textDecoration: 'none', transition: 'background 0.12s',
                    }}
                    className="prow-link">
                    <div style={{ height: '32px', borderRadius: '2px', background: URGENCY_COLOR[t.urgency] ?? '#ccc', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                        {t.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--p-t3)' }}>
                        <span className="mono" style={{ fontSize: '10px' }}>{t.ticketCode}</span>
                        {t.branch && <> · {t.branch.name}</>}
                        {' · '}{new Date(t.createdAt).toLocaleDateString('es-CL')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span className={SB[t.status] ?? 'badge'} style={{ fontSize: '10px' }}>{SL[t.status] ?? t.status}</span>
                      {t.estimatedDate && (
                        <div style={{ fontSize: '10px', color: daysBetween(String(t.estimatedDate)) < 0 ? '#ef4444' : 'var(--p-t3)', marginTop: '3px' }}>
                          {daysBetween(String(t.estimatedDate)) < 0
                            ? `${Math.abs(daysBetween(String(t.estimatedDate)))}d vencido`
                            : `${daysBetween(String(t.estimatedDate))}d restantes`}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Branch distribution */}
            {branchList.length > 0 && (
              <div className="pcard" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Distribución sucursales
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {branchList.map(([name, count]) => (
                    <div key={name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--p-text)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{name}</span>
                        <span style={{ color: 'var(--p-t3)', fontWeight: '600', flexShrink: 0 }}>{count}</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--p-bd)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: theme.primary, borderRadius: '4px', width: `${(count / maxBranch) * 100}%`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="pcard" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--p-t3)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Acciones rápidas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '13px' }}>
                  + Nueva solicitud
                </Link>
                <Link href={`/portal/${slug}/tickets`} className="pbtn pbtn-ghost" style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '13px' }}>
                  Ver todos los tickets
                </Link>
                <Link href={`/portal/${slug}/reportes`} className="pbtn pbtn-ghost" style={{ textDecoration: 'none', justifyContent: 'center', fontSize: '13px' }}>
                  Ver reportes
                </Link>
              </div>
            </div>

            {/* SLA snapshot */}
            {tickets.length > 0 && (() => {
              const withDate = tickets.filter(t => t.estimatedDate)
              const onTime = withDate.filter(t => t.status === 'resuelto' && daysBetween(String(t.estimatedDate)) >= 0)
              const pct = withDate.length ? Math.round((onTime.length / withDate.filter(t => t.status === 'resuelto').length || 0) * 100) : null
              return (
                <div className="pcard" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--p-t3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Resumen SLA</div>
                  {[
                    { l: 'Total solicitudes', v: tickets.length },
                    { l: 'Cerradas este mes', v: resMes.length },
                    { l: 'Con fecha estimada', v: withDate.length },
                    ...(pct !== null ? [{ l: 'Cumpl. a tiempo', v: `${pct}%` }] : []),
                  ].map(({ l, v }) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--p-bd)', fontSize: '12px' }}>
                      <span style={{ color: 'var(--p-t3)' }}>{l}</span>
                      <span style={{ fontWeight: '700', color: 'var(--p-text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </PortalShell>
  )
}
