import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getClientTickets } from '@/lib/tickets/tickets'
import { canViewPortal, isStaffViewing } from '@/lib/portal-auth'
import { PortalShell } from '@/components/tickets/portal-shell'
import { resolvePortalTheme } from '@/lib/portal-theme'
import {
  PORTAL_STATUS_BADGE as SB,
  PORTAL_STATUS_SHORT as SL,
} from '@/lib/tickets/labels'
import { URGENCY_COLORS as URG_COLOR, C } from '@/lib/portal-colors'

const OPEN   = ['nuevo','en_revision','en_ejecucion','esperando_aprobacion']
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function daysBetween(d: string) {
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000)
}
function localYearMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

type Ticket = Awaited<ReturnType<typeof getClientTickets>>[number]

function BarChart({ months, acc, t2, t3, bd }: {
  months: { key:string; label:string; active:number; resolved:number; total:number }[]
  acc: string; t2: string; t3: string; bd: string
}) {
  const W=480, H=100, PL=24, PR=8, PT=12, PB=22, GH=H-PT-PB
  const maxV = Math.max(...months.map(m=>m.total), 1)
  const bW = Math.floor((W-PL-PR)/months.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
      {[0,1,2,3,4].map(g => {
        const y = PT+GH*(1-g/4)
        return <g key={g}>
          <line x1={PL} x2={W-PR} y1={y} y2={y} stroke={bd} strokeWidth="1" strokeDasharray={g?'3,3':''} />
          {g>0 && <text x={PL-4} y={y+3} textAnchor="end" fontSize="8" fill={t3} fontFamily="Inter,sans-serif">{Math.round(maxV*g/4)}</text>}
        </g>
      })}
      {months.map((m,i) => {
        const x=PL+i*bW+bW*0.12, bw=bW*0.76
        const rh=m.resolved?Math.max((m.resolved/maxV)*GH,2):0
        const ah=m.active?Math.max((m.active/maxV)*GH,2):0
        return <g key={m.key}>
          {rh>0 && <rect x={x} y={H-PB-rh-ah} width={bw} height={rh} fill={C.success} rx="2" opacity=".75"/>}
          {ah>0 && <rect x={x} y={H-PB-ah} width={bw} height={ah} fill={acc} rx="2"/>}
          {m.total===0 && <rect x={x} y={H-PB-2} width={bw} height={2} fill={bd} rx="1"/>}
          {m.total>0 && <text x={x+bw/2} y={H-PB-(m.total/maxV)*GH-3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={t2} fontFamily="Inter,sans-serif">{m.total}</text>}
          <text x={x+bw/2} y={H-PB+13} textAnchor="middle" fontSize="9" fill={t3} fontFamily="Inter,sans-serif">{m.label}</text>
        </g>
      })}
    </svg>
  )
}

export default async function PortalDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session  = await auth()
  const client   = await prisma.client.findUnique({
    where: { portalSlug: slug },
    select: { id: true, name: true, portalTheme: true },
  })
  if (!client) notFound()
  if (!canViewPortal(session, client.id)) redirect(`/portal/${slug}`)

  const isStaff = isStaffViewing(session)
  const tickets = await getClientTickets(client.id)
  const theme   = resolvePortalTheme(client.portalTheme)
  const acc     = theme.primary
  const T = { tx: theme.text, t2: '#4b4540', t3: '#8c857e', t4: '#beb7b0', bd: '#e0ddd8', s2: '#f8f7f5', s3: '#efedea' }

  // ── KPI calculations (matching Excel v2 panel) ──
  const act        = tickets.filter(t => OPEN.includes(t.status))
  const inProc     = act.filter(t => t.status !== 'nuevo')
  const mes        = localYearMonth()
  const resMes     = tickets.filter(t => t.status==='resuelto' && t.closedDate && String(t.closedDate).startsWith(mes))
  const vnc        = act.filter(t => t.estimatedDate && daysBetween(String(t.estimatedDate)) < 0)
  const emg        = tickets.filter(t => t.urgency==='emergencia' && OPEN.includes(t.status))
  // eslint-disable-next-line react-hooks/purity
  const nowMs      = Date.now()
  const todayStr   = new Date().toISOString().slice(0, 10)
  const sinAbordar = act.filter(t => t.status==='nuevo' && (nowMs-new Date(t.createdAt).getTime()) > 86_400_000)
  const hoy        = tickets.filter(t => String(t.createdAt).startsWith(todayStr))
  const sucursales = new Set(act.filter(t => t.branch).map(t => t.branch!.name)).size

  // SLA: resolved tickets with date that closed on time
  const withDate   = tickets.filter(t => t.status==='resuelto' && t.estimatedDate && t.closedDate)
  const onTime     = withDate.filter(t => new Date(String(t.closedDate!)).getTime() <= new Date(String(t.estimatedDate!)).getTime())
  const slaPct     = withDate.length ? Math.round((onTime.length/withDate.length)*100) : null

  const nombre = (session?.user?.name ?? 'Cliente').split(' ')[0]
  const hoyStr = new Date().toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' })

  const now = new Date()
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now); d.setMonth(d.getMonth()-(5-i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    let active=0, resolved=0
    tickets.forEach(t => { if(!String(t.createdAt).startsWith(key)) return; if(['resuelto','cancelado'].includes(t.status)) resolved++; else active++ })
    return { key, label: MONTHS[d.getMonth()], active, resolved, total: active+resolved }
  })

  const byBranch = act.reduce<Record<string,number>>((a,t)=>{ const n=t.branch?.name??'Sin sucursal'; a[n]=(a[n]??0)+1; return a }, {})
  const branchList = Object.entries(byBranch).sort((a,b)=>b[1]-a[1]).slice(0,8)
  const maxBranch = Math.max(...branchList.map(b=>b[1]), 1)

  // 8 KPIs — same as Excel v2
  const kpis = [
    { l:'Hoy',             n: hoy.length,        c: acc,      s: 'creados hoy' },
    { l:'En proceso',      n: inProc.length,      c: C.info,   s: 'INGEGAR trabajando' },
    { l:'Sin abordar +24h', n: sinAbordar.length, c: sinAbordar.length ? '#ef4444' : C.success, s: sinAbordar.length ? 'Requieren atención' : 'Al día', alert: sinAbordar.length > 0 },
    { l:'Emergencias',     n: emg.length,         c: emg.length ? '#ef4444' : C.success, s: emg.length ? 'Atención urgente' : 'Sin emergencias', alert: emg.length > 0 },
    { l:'Resueltos mes',   n: resMes.length,      c: C.success, s: 'este mes' },
    { l:'Cumpl. SLA',      n: slaPct !== null ? `${slaPct}%` : '—', c: slaPct !== null ? (slaPct >= 80 ? C.success : slaPct >= 50 ? '#f59e0b' : '#ef4444') : T.t3, s: slaPct !== null ? `${onTime.length}/${withDate.length} a tiempo` : 'sin datos' },
    { l:'Sucursales',      n: sucursales,          c: '#6366f1', s: 'con activos' },
    { l:'Vencidos',        n: vnc.length,          c: vnc.length ? '#ef4444' : C.success, s: vnc.length ? 'Fuera de plazo' : 'Al día', alert: vnc.length > 0 },
  ]

  const btnNuevo = (
    <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ textDecoration:'none', fontSize:'13px', padding:'7px 16px' }}>
      + Nueva solicitud
    </Link>
  )

  return (
    <PortalShell slug={slug} clientName={client.name} userName={session!.user.name??'Usuario'}
      primary={acc} bg={theme.bg} cardBg={theme.card ?? '#ffffff'} textColor={theme.text}
      activeHref={`/portal/${slug}/dashboard`}
      topbarTitle="Panel" topbarSub={`${tickets.length} solicitudes · ${act.length} activas`} topbarRight={btnNuevo}
      isAdmin={isStaff}>
      <div className="pg">

        {/* Greeting */}
        <div style={{ marginBottom:'14px' }}>
          <div style={{ fontSize:'17px', fontWeight:'800', color:T.tx, letterSpacing:'-0.3px' }}>Hola, {nombre} 👋</div>
          <div style={{ fontSize:'12px', color:T.t3, marginTop:'3px', textTransform:'capitalize' }}>{hoyStr}</div>
        </div>

        {/* Alert banners */}
        {sinAbordar.length > 0 && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 16px', display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L14.5 13H1.5L8 1.5z" fill="#ef4444"/><path d="M8 6v3.5M8 11.5v.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <strong style={{ color:'#b91c1c', fontSize:'13px' }}>{sinAbordar.length} ticket{sinAbordar.length>1?'s':''} sin abordar (+24h en Nuevo).</strong>
            <Link href={`/portal/${slug}/tickets`} style={{ marginLeft:'auto', fontSize:'12px', fontWeight:'700', color:acc, textDecoration:'none', flexShrink:0 }}>Ver →</Link>
          </div>
        )}
        {vnc.length > 0 && (
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'10px 16px', display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#f59e0b" strokeWidth="1.5"/><path d="M8 5v3.5M8 10.5v.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <strong style={{ color:'#92400e', fontSize:'13px' }}>{vnc.length} requerimiento{vnc.length>1?'s':''} fuera de plazo. Revisar fechas estimadas.</strong>
            <Link href={`/portal/${slug}/tickets`} style={{ marginLeft:'auto', fontSize:'12px', fontWeight:'700', color:acc, textDecoration:'none', flexShrink:0 }}>Ver →</Link>
          </div>
        )}

        {/* KPI grid — 4 cols desktop, 2 cols mobile (matches Excel v2) */}
        <div className="pw-kpi" style={{ marginBottom:'18px', gridTemplateColumns:'repeat(4, 1fr)' }}>
          {kpis.map(({ l, n, c, s, alert }) => (
            <div key={l} style={{
              background: theme.card,
              border: `1px solid ${alert ? '#fecaca' : T.bd}`,
              borderRadius:'14px',
              boxShadow: alert ? '0 0 0 3px rgba(239,68,68,0.08)' : '0 1px 3px rgba(0,0,0,0.07)',
              padding:'16px 18px',
            }}>
              <div style={{ fontSize:'26px', fontWeight:'800', color:c, lineHeight:1, marginBottom:'4px', fontVariantNumeric:'tabular-nums' }}>{n}</div>
              <div style={{ fontSize:'11px', fontWeight:'700', color:T.tx, marginBottom:'2px', lineHeight:'1.2' }}>{l}</div>
              <div style={{ fontSize:'10px', color:T.t3 }}>{s}</div>
            </div>
          ))}
        </div>

        {/* 2-col: chart + list | sidebar */}
        <div className="pw-dash">
          {/* Left */}
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            {/* Bar chart */}
            <div style={{ background:theme.card, border:`1px solid ${T.bd}`, borderRadius:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', padding:'16px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:'700', color:T.tx }}>Solicitudes por mes</div>
                  <div style={{ fontSize:'11px', color:T.t3 }}>Últimos 6 meses</div>
                </div>
                <div style={{ display:'flex', gap:'12px', fontSize:'11px', color:T.t3 }}>
                  <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                    <span style={{ width:'8px', height:'8px', borderRadius:'2px', background:acc, display:'inline-block' }}/>Activos
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                    <span style={{ width:'8px', height:'8px', borderRadius:'2px', background:C.success, display:'inline-block' }}/>Resueltos
                  </span>
                </div>
              </div>
              <BarChart months={months} acc={acc} t2={T.t2} t3={T.t3} bd={T.bd} />
            </div>

            {/* Active tickets list */}
            <div style={{ background:theme.card, border:`1px solid ${T.bd}`, borderRadius:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px 11px', borderBottom:`1px solid ${T.bd}` }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:T.tx }}>Requerimientos activos</div>
                <Link href={`/portal/${slug}/tickets`} style={{ fontSize:'12px', fontWeight:'700', color:acc, textDecoration:'none' }}>Ver todos →</Link>
              </div>
              {act.length === 0 ? (
                <div style={{ padding:'32px 16px', textAlign:'center', color:T.t3, fontSize:'13px' }}>
                  Sin activos. <Link href={`/portal/${slug}/tickets/new`} style={{ color:acc, fontWeight:'600' }}>Crear uno →</Link>
                </div>
              ) : act.slice(0,8).map((t, i) => (
                <Link key={t.id} href={`/portal/${slug}/tickets/${t.id}`}
                  style={{
                    display:'grid', gridTemplateColumns:'3px 1fr auto', alignItems:'center', gap:'12px',
                    padding:'11px 16px', borderBottom: i<Math.min(act.length,8)-1?`1px solid ${T.bd}`:'none',
                    textDecoration:'none', background: theme.card,
                  }}
                  className="prow-link">
                  <div style={{ height:'36px', borderRadius:'2px', background:URG_COLOR[t.urgency]??'#ccc', flexShrink:0 }} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'13px', fontWeight:'600', color:T.tx, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                    <div style={{ fontSize:'11px', color:T.t3, marginTop:'2px', fontFamily:"'JetBrains Mono', monospace" }}>
                      <span style={{ fontSize:'10px' }}>{t.ticketCode}</span>
                      {t.branch && <span style={{ fontFamily:'Inter, sans-serif' }}> · {t.branch.name}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <span className={SB[t.status]??'badge'} style={{ fontSize:'10px' }}>{SL[t.status]??t.status}</span>
                    {t.estimatedDate && (
                      <div style={{ fontSize:'10px', color:daysBetween(String(t.estimatedDate))<0?'#ef4444':T.t3, marginTop:'3px' }}>
                        {daysBetween(String(t.estimatedDate))<0
                          ? `${Math.abs(daysBetween(String(t.estimatedDate)))}d vencido`
                          : `${daysBetween(String(t.estimatedDate))}d restantes`}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {act.length > 8 && (
                <div style={{ padding:'10px 16px', borderTop:`1px solid ${T.bd}`, textAlign:'center' }}>
                  <Link href={`/portal/${slug}/tickets`} style={{ fontSize:'12px', fontWeight:'700', color:acc, textDecoration:'none' }}>
                    Ver {act.length - 8} más →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            {/* Branch distribution */}
            {branchList.length > 0 && (
              <div style={{ background:theme.card, border:`1px solid ${T.bd}`, borderRadius:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:'700', color:T.t3, marginBottom:'14px', textTransform:'uppercase', letterSpacing:'1px' }}>
                  Sucursales activas <span style={{ float:'right', color:T.t4 }}>{sucursales}</span>
                </div>
                {branchList.map(([name, count]) => (
                  <div key={name} style={{ marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px' }}>
                      <span style={{ color:T.tx, fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'150px' }}>{name}</span>
                      <span style={{ color:T.t3, fontWeight:'600', flexShrink:0 }}>{count}</span>
                    </div>
                    <div style={{ height:'4px', background:T.s3, borderRadius:'4px', overflow:'hidden' }}>
                      <div style={{ height:'100%', background:acc, borderRadius:'4px', width:`${(count/maxBranch)*100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick actions */}
            <div style={{ background:theme.card, border:`1px solid ${T.bd}`, borderRadius:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:T.t3, marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Acciones</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                <Link href={`/portal/${slug}/tickets/new`} style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'9px 18px', borderRadius:'10px', background:acc, color:'#fff', textDecoration:'none', fontSize:'13px', fontWeight:'700' }}>+ Nueva solicitud</Link>
                <Link href={`/portal/${slug}/tickets`} style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'9px 18px', borderRadius:'10px', background:theme.card, color:T.t2, border:`1px solid ${T.bd}`, textDecoration:'none', fontSize:'13px', fontWeight:'600' }}>Todos los tickets</Link>
                <Link href={`/portal/${slug}/informes`} style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'9px 18px', borderRadius:'10px', background:theme.card, color:T.t2, border:`1px solid ${T.bd}`, textDecoration:'none', fontSize:'13px', fontWeight:'600' }}>Informes técnicos</Link>
                <Link href={`/portal/${slug}/reportes`} style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'9px 18px', borderRadius:'10px', background:theme.card, color:T.t2, border:`1px solid ${T.bd}`, textDecoration:'none', fontSize:'13px', fontWeight:'600' }}>Ver reportes</Link>
              </div>
            </div>

            {/* Stats */}
            <div style={{ background:theme.card, border:`1px solid ${T.bd}`, borderRadius:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', padding:'14px 16px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:T.t3, marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1px' }}>Resumen</div>
              {[
                { l:'Total solicitudes', v: tickets.length },
                { l:'Activas',           v: act.length },
                { l:'Resueltas',         v: tickets.filter(t=>t.status==='resuelto').length },
                { l:'Cerradas este mes', v: resMes.length },
              ].map(({l,v}) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${T.bd}`, fontSize:'12px' }}>
                  <span style={{ color:T.t3 }}>{l}</span>
                  <span style={{ fontWeight:'700', color:T.tx, fontVariantNumeric:'tabular-nums' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  )
}
