import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTickets } from '@/lib/tickets/tickets'
import { canViewPortal } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import { resolvePortalTheme } from '@/lib/portal-theme'

const OPEN = ['nuevo','en_revision','en_ejecucion','esperando_aprobacion']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const URG_COLOR: Record<string, string> = {
  emergencia: '#ef4444', urgencia: '#f59e0b', no_urgente: '#22c55e', preventivo: '#3b82f6',
}
const URG_LABEL: Record<string, string> = {
  emergencia: 'Emergencia', urgencia: 'Urgente', no_urgente: 'Normal', preventivo: 'Preventivo',
}
const STATUS_COLOR: Record<string, string> = {
  nuevo: '#3b82f6', en_revision: '#f59e0b', en_ejecucion: '#f97316',
  esperando_aprobacion: '#8b5cf6', resuelto: '#22c55e', cancelado: '#9ca3af',
}
const STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', en_revision: 'En revisión', en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esp. aprobación', resuelto: 'Resuelto', cancelado: 'Cancelado',
}

function daysBetween(dateStr: string) {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

type Ticket = Awaited<ReturnType<typeof getClientTickets>>[number]

function trendArrow(good: boolean, neutral = false) {
  if (neutral) return { icon: '→', color: '#6b7280' }
  return good ? { icon: '↑', color: '#22c55e' } : { icon: '↓', color: '#ef4444' }
}

export default async function PortalReportesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await auth()
  const client = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const tickets: Ticket[] = await getClientTickets(client.id)
  const theme = resolvePortalTheme(client.portalTheme)

  const act = tickets.filter(t => OPEN.includes(t.status))
  const res = tickets.filter(t => t.status === 'resuelto')
  const vnc = act.filter(t => t.estimatedDate && daysBetween(String(t.estimatedDate)) < 0)
  const emg = tickets.filter(t => t.urgency === 'emergencia')
  const tasaRes = tickets.length ? Math.round((res.length / tickets.length) * 100) : 0

  // SLA: resolved tickets that had an estimated date and closed before/on it
  const withDate = res.filter(t => t.estimatedDate && t.closedDate)
  const onTime = withDate.filter(t => {
    const est = new Date(String(t.estimatedDate!)).getTime()
    const cls = new Date(String(t.closedDate!)).getTime()
    return cls <= est
  })
  const slaPct = withDate.length ? Math.round((onTime.length / withDate.length) * 100) : null

  // Monthly trend (last 6 months)
  const now = new Date()
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const monthTickets = tickets.filter(t => String(t.createdAt).startsWith(key))
    const monthRes = tickets.filter(t => t.status === 'resuelto' && String(t.closedDate ?? '').startsWith(key))
    return { month: MONTHS[d.getMonth()].substring(0,3), total: monthTickets.length, resolved: monthRes.length }
  })

  // By branch
  const byBranch: Record<string, { total: number; open: number; resolved: number }> = {}
  tickets.forEach(t => {
    const b = t.branch?.name ?? 'Sin sucursal'
    if (!byBranch[b]) byBranch[b] = { total: 0, open: 0, resolved: 0 }
    byBranch[b].total++
    if (OPEN.includes(t.status)) byBranch[b].open++
    if (t.status === 'resuelto') byBranch[b].resolved++
  })
  const branchRows = Object.entries(byBranch).sort((a, b) => b[1].total - a[1].total)

  // By urgency
  const byUrgency: Record<string, number> = {}
  tickets.forEach(t => { byUrgency[t.urgency] = (byUrgency[t.urgency] ?? 0) + 1 })

  // By status distribution
  const byStatus: Record<string, number> = {}
  tickets.forEach(t => { byStatus[t.status] = (byStatus[t.status] ?? 0) + 1 })

  const kpis = [
    { l: 'Total solicitudes', v: tickets.length, trend: trendArrow(false, true), sub: 'historial completo' },
    { l: 'Activas',           v: act.length,     trend: trendArrow(act.length === 0), sub: act.length ? 'en trámite' : 'sin activas' },
    { l: 'Resueltas',         v: res.length,     trend: trendArrow(res.length > 0, res.length === 0), sub: `${tasaRes}% tasa` },
    { l: 'Vencidas',          v: vnc.length,     trend: trendArrow(vnc.length === 0), sub: vnc.length ? 'fuera de plazo' : 'al día' },
    { l: 'Emergencias',       v: emg.length,     trend: trendArrow(emg.length === 0), sub: 'histórico' },
    ...(slaPct !== null ? [{ l: 'Cumpl. SLA', v: `${slaPct}%`, trend: trendArrow(slaPct >= 80, slaPct >= 60 && slaPct < 80), sub: `${onTime.length}/${withDate.length} a tiempo` }] : []),
  ]

  return (
    <PortalShell slug={slug} clientName={client.name} userName={session!.user.name ?? 'Usuario'}
      primary={theme.primary} bg={theme.bg} cardBg={theme.card} textColor={theme.text}
      activeHref={`/portal/${slug}/reportes`}
      topbarTitle="Reportes" topbarSub="Resumen estadístico de solicitudes">
      <div style={{ padding: '20px 28px' }}>

        {/* Header strip */}
        <div style={{
          background: `linear-gradient(135deg, ${theme.primary} 0%, color-mix(in srgb, ${theme.primary} 60%, #000) 100%)`,
          borderRadius: 'var(--p-r3)', padding: '18px 22px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
        }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px' }}>Análisis de solicitudes</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginTop: '2px' }}>{client.name} · {tickets.length} solicitudes totales</div>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
            Actualizado {new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '10px', marginBottom: '20px' }}>
          {kpis.map(({ l, v, trend, sub }) => (
            <div key={l} className="pcard" style={{ padding: '16px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--p-text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <span style={{ fontSize: '14px', fontWeight: '700', color: trend.color }}>{trend.icon}</span>
              </div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-text)', marginBottom: '2px' }}>{l}</div>
              <div style={{ fontSize: '10px', color: 'var(--p-t3)' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* 2-col: monthly trend + by urgency */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

          {/* Monthly */}
          <div className="pcard" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '14px', color: 'var(--p-text)' }}>Tendencia mensual</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {monthlyData.map(({ month, total, resolved }) => (
                <div key={month}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--p-t2)', fontWeight: '600' }}>{month}</span>
                    <span style={{ color: 'var(--p-t3)', fontSize: '11px' }}>{total} total · {resolved} resueltos</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--p-bd)', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                    {resolved > 0 && total > 0 && (
                      <div style={{ height: '100%', background: '#22c55e', width: `${(resolved/Math.max(total,1))*100}%`, opacity: 0.8 }} />
                    )}
                    {(total - resolved) > 0 && total > 0 && (
                      <div style={{ height: '100%', background: theme.primary, flex: 1, opacity: 0.7 }} />
                    )}
                    {total === 0 && <div style={{ height: '100%', background: 'var(--p-bd)', width: '100%' }} />}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '14px', fontSize: '10px', color: 'var(--p-t3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: theme.primary, display: 'inline-block', opacity: 0.7 }} />Activos
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#22c55e', display: 'inline-block', opacity: 0.8 }} />Resueltos
              </span>
            </div>
          </div>

          {/* By urgency + status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--p-text)' }}>Por urgencia</div>
              {Object.entries(byUrgency).sort((a, b) => b[1] - a[1]).map(([urg, n]) => {
                const total = tickets.length || 1
                return (
                  <div key={urg} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: URG_COLOR[urg] ?? '#666', minWidth: '80px' }}>{URG_LABEL[urg] ?? urg}</span>
                    <div style={{ flex: 1, height: '5px', background: 'var(--p-bd)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: URG_COLOR[urg] ?? '#ccc', width: `${(n/total)*100}%`, opacity: 0.8 }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', minWidth: '24px', textAlign: 'right' }}>{n}</span>
                  </div>
                )
              })}
            </div>
            <div className="pcard" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--p-text)' }}>Por estado</div>
              {Object.entries(byStatus).filter(([s]) => s !== 'fusionado').sort((a, b) => b[1] - a[1]).map(([st, n]) => {
                const total = tickets.length || 1
                return (
                  <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '9px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: STATUS_COLOR[st] ?? '#666', minWidth: '100px', whiteSpace: 'nowrap' }}>{STATUS_LABEL[st] ?? st}</span>
                    <div style={{ flex: 1, height: '5px', background: 'var(--p-bd)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: STATUS_COLOR[st] ?? '#ccc', width: `${(n/total)*100}%`, opacity: 0.75 }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)', minWidth: '24px', textAlign: 'right' }}>{n}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* By branch table */}
        {branchRows.length > 0 && (
          <div className="pcard" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--p-bd)', fontSize: '13px', fontWeight: '700', color: 'var(--p-text)' }}>
              Distribución por sucursal
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--p-bd)' }}>
                  {['Sucursal','Total','Activos','Resueltos','% Resolución'].map(h => (
                    <th key={h} style={{ padding: '9px 16px', fontSize: '10px', fontWeight: '700', color: 'var(--p-t3)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchRows.map(([name, { total, open: o, resolved: r }], i) => {
                  const pct = total ? Math.round((r / total) * 100) : 0
                  return (
                    <tr key={name} style={{ borderBottom: i < branchRows.length - 1 ? '1px solid var(--p-bd)' : 'none' }}>
                      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--p-text)' }}>{name}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '700', color: 'var(--p-text)', fontVariantNumeric: 'tabular-nums' }}>{total}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: o > 0 ? theme.primary : 'var(--p-t3)' }}>{o}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: r > 0 ? '#22c55e' : 'var(--p-t3)' }}>{r}</span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '80px', height: '5px', background: 'var(--p-bd)', borderRadius: '5px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : theme.primary, width: `${pct}%` }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--p-t2)' }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalShell>
  )
}
