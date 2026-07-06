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

const CATEGORY_LABELS: Record<string,string> = {
  mantencion_correctiva: 'Correctivo',
  mantencion_preventiva: 'Preventivo',
  instalacion:           'Instalación',
  inspeccion:            'Inspección',
  emergencia:            'Emergencia',
  garantia:              'Garantía',
  otro:                  'Otro',
}

function daysBetween(d: string) {
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000)
}
function localYearMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = diff / 3600000
  if (h < 1) return `${Math.round(diff/60000)}m`
  if (h < 24) return `${Math.floor(h)}h`
  const d = Math.floor(h/24)
  if (d < 30) return `${d}d`
  return `${Math.floor(d/30)}mo`
}

function MiniBar({ months, acc }: { months: { key:string; label:string; active:number; resolved:number; total:number }[]; acc: string }) {
  const maxV = Math.max(...months.map(m => m.total), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:'4px', height:'52px' }}>
      {months.map(m => {
        const activeH = m.active  ? Math.max((m.active/maxV)*44, 3) : 0
        const resolvedH = m.resolved ? Math.max((m.resolved/maxV)*44, 3) : 0
        return (
          <div key={m.key} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
            <div style={{ display:'flex', flexDirection:'column-reverse', alignItems:'center', gap:'1px', width:'100%' }}>
              {activeH>0 && <div style={{ width:'100%', height:`${activeH}px`, background:acc, borderRadius:'3px 3px 0 0', opacity:0.9 }}/>}
              {resolvedH>0 && <div style={{ width:'100%', height:`${resolvedH}px`, background:C.success, borderRadius:'3px 3px 0 0', opacity:0.7 }}/>}
              {m.total===0 && <div style={{ width:'100%', height:'3px', background:'#e0ddd8', borderRadius:'2px' }}/>}
            </div>
            <div style={{ fontSize:'9px', color:'#8c857e', marginTop:'2px' }}>{m.label}</div>
          </div>
        )
      })}
    </div>
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
  const acc = theme.primary

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const act     = tickets.filter(t => OPEN.includes(t.status))
  const inProc  = act.filter(t => t.status !== 'nuevo')
  const mes     = localYearMonth()
  const resMes  = tickets.filter(t => t.status==='resuelto' && t.closedDate && String(t.closedDate).startsWith(mes))
  const vnc     = act.filter(t => t.estimatedDate && daysBetween(String(t.estimatedDate)) < 0)
  const emg     = tickets.filter(t => t.urgency==='emergencia' && OPEN.includes(t.status))
  const sinAbordar = act.filter(t => t.status==='nuevo' && (Date.now()-new Date(t.createdAt).getTime()) > 86_400_000)
  const hoy     = tickets.filter(t => String(t.createdAt).startsWith(new Date().toISOString().slice(0,10)))
  const sucursales = new Set(act.filter(t => t.branch).map(t => t.branch!.name)).size

  const withDate = tickets.filter(t => t.status==='resuelto' && t.estimatedDate && t.closedDate)
  const onTime   = withDate.filter(t => new Date(String(t.closedDate!)).getTime() <= new Date(String(t.estimatedDate!)).getTime())
  const slaPct   = withDate.length ? Math.round((onTime.length/withDate.length)*100) : null

  const nombre = (session?.user?.name ?? 'Cliente').split(' ')[0]
  const hoyStr = new Date().toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' })

  // 6 months chart data
  const now = new Date()
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now); d.setMonth(d.getMonth()-(5-i))
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    let active=0, resolved=0
    tickets.forEach(t => { if(!String(t.createdAt).startsWith(key)) return; if(['resuelto','cancelado'].includes(t.status)) resolved++; else active++ })
    return { key, label: MONTHS[d.getMonth()], active, resolved, total: active+resolved }
  })

  const byBranch = act.reduce<Record<string,number>>((a,t)=>{ const n=t.branch?.name??'Sin sucursal'; a[n]=(a[n]??0)+1; return a }, {})
  const branchList = Object.entries(byBranch).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const maxBranch = Math.max(...branchList.map(b=>b[1]), 1)

  const hasAlerts = sinAbordar.length > 0 || vnc.length > 0 || emg.length > 0

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
          70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes pulse-ring-warn {
          0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0.3); }
          70%  { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        }
        .kpi-alert     { animation: pulse-ring 2.2s ease-out infinite; }
        .kpi-alert-warn{ animation: pulse-ring-warn 2.2s ease-out infinite; }

        .trow:hover { background: #f8f7f5 !important; }
        .trow:active { background: #efedea !important; }
        .trow { transition: background 0.1s; }

        @media (max-width:860px) {
          .kpi-grid-top { grid-template-columns: 1fr 1fr !important; }
          .kpi-val-lg   { font-size: 40px !important; }
        }
        @media (max-width:480px) {
          .kpi-grid-top { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .kpi-val-lg   { font-size: 34px !important; }
        }
      `}</style>

      <PortalShell slug={slug} clientName={client.name} userName={session!.user.name??'Usuario'}
        primary={acc} bg={theme.bg} cardBg={theme.card} textColor={theme.text}
        activeHref={`/portal/${slug}/dashboard`}
        topbarTitle="Panel" topbarSub={`${act.length} activas · ${tickets.length} total`}
        topbarRight={
          <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ fontSize:'13px', padding:'8px 16px', textDecoration:'none', minHeight:'36px' }}>
            + Nueva
          </Link>
        }
        isAdmin={isStaff}>
        <div className="pg">

          {/* ── Greeting ── */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'18px', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ fontSize:'18px', fontWeight:'800', color:'#18130e', letterSpacing:'-0.3px' }}>
                Hola, {nombre} 👋
              </div>
              <div style={{ fontSize:'12px', color:'#8c857e', marginTop:'2px', textTransform:'capitalize' }}>{hoyStr}</div>
            </div>
            {hasAlerts && (
              <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'6px 12px' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', flexShrink:0 }} />
                <span style={{ fontSize:'12px', fontWeight:'600', color:'#b91c1c' }}>
                  {[sinAbordar.length > 0 && `${sinAbordar.length} sin abordar`, emg.length > 0 && `${emg.length} emergencias`, vnc.length > 0 && `${vnc.length} vencidos`].filter(Boolean).join(' · ')}
                </span>
                <Link href={`/portal/${slug}/tickets`} style={{ fontSize:'11px', fontWeight:'700', color:acc, textDecoration:'none', marginLeft:'4px' }}>Ver →</Link>
              </div>
            )}
          </div>

          {/* ── Primary KPIs — 4 col desktop, 2 col mobile ── */}
          <div className="kpi-grid-top" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'10px' }}>

            {/* Activas — hero metric */}
            <Link href={`/portal/${slug}/tickets`} style={{ textDecoration:'none', gridColumn:'span 1' }}>
              <div className="pcard pcard-hover" style={{ padding:'18px 20px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:acc, borderRadius:'14px 14px 0 0' }} />
                <div className="kpi-val-lg" style={{ fontSize:'46px', fontWeight:'800', color:acc, lineHeight:1, marginBottom:'4px', fontVariantNumeric:'tabular-nums' }}>
                  {act.length}
                </div>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'#18130e' }}>Activas</div>
                <div style={{ fontSize:'11px', color:'#8c857e', marginTop:'1px' }}>{inProc.length} en proceso</div>
              </div>
            </Link>

            {/* Emergencias */}
            <Link href={`/portal/${slug}/tickets`} style={{ textDecoration:'none' }}>
              <div className={`pcard pcard-hover ${emg.length>0 ? 'kpi-alert' : ''}`}
                style={{ padding:'18px 20px', borderColor: emg.length>0 ? '#fecaca' : undefined }}>
                <div style={{ fontSize:'36px', fontWeight:'800', color: emg.length>0 ? '#ef4444' : C.success, lineHeight:1, marginBottom:'4px', fontVariantNumeric:'tabular-nums' }}>
                  {emg.length}
                </div>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'#18130e' }}>Emergencias</div>
                <div style={{ fontSize:'11px', color: emg.length>0 ? '#ef4444' : '#8c857e', marginTop:'1px' }}>
                  {emg.length>0 ? 'Atención urgente' : 'Sin emergencias'}
                </div>
              </div>
            </Link>

            {/* Sin abordar */}
            <Link href={`/portal/${slug}/tickets`} style={{ textDecoration:'none' }}>
              <div className={`pcard pcard-hover ${sinAbordar.length>0 ? 'kpi-alert' : ''}`}
                style={{ padding:'18px 20px', borderColor: sinAbordar.length>0 ? '#fecaca' : undefined }}>
                <div style={{ fontSize:'36px', fontWeight:'800', color: sinAbordar.length>0 ? '#ef4444' : C.success, lineHeight:1, marginBottom:'4px', fontVariantNumeric:'tabular-nums' }}>
                  {sinAbordar.length}
                </div>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'#18130e' }}>Sin abordar</div>
                <div style={{ fontSize:'11px', color: sinAbordar.length>0 ? '#ef4444' : '#8c857e', marginTop:'1px' }}>
                  {sinAbordar.length>0 ? '+24h sin respuesta' : 'Todo al día'}
                </div>
              </div>
            </Link>

            {/* Vencidos */}
            <Link href={`/portal/${slug}/tickets`} style={{ textDecoration:'none' }}>
              <div className={`pcard pcard-hover ${vnc.length>0 ? 'kpi-alert-warn' : ''}`}
                style={{ padding:'18px 20px', borderColor: vnc.length>0 ? '#fde68a' : undefined }}>
                <div style={{ fontSize:'36px', fontWeight:'800', color: vnc.length>0 ? '#f59e0b' : C.success, lineHeight:1, marginBottom:'4px', fontVariantNumeric:'tabular-nums' }}>
                  {vnc.length}
                </div>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'#18130e' }}>Vencidos</div>
                <div style={{ fontSize:'11px', color: vnc.length>0 ? '#f59e0b' : '#8c857e', marginTop:'1px' }}>
                  {vnc.length>0 ? 'Fuera de plazo' : 'Dentro de plazos'}
                </div>
              </div>
            </Link>
          </div>

          {/* ── Secondary KPIs ── */}
          <div className="pw-kpi" style={{ marginBottom:'18px' }}>
            {[
              { l:'Hoy', n: hoy.length, c:'#6366f1', s:'creados hoy' },
              { l:'Resueltos mes', n: resMes.length, c: C.success, s:'este mes' },
              { l:'Cumpl. SLA', n: slaPct!==null ? `${slaPct}%` : '—', c: slaPct!==null ? (slaPct>=80?C.success:slaPct>=50?'#f59e0b':'#ef4444') : '#8c857e', s: slaPct!==null ? `${onTime.length}/${withDate.length} a tiempo` : 'sin datos' },
              { l:'Sucursales', n: sucursales, c:'#8b5cf6', s:'con activos' },
            ].map(({ l, n, c, s }) => (
              <Link key={l} href={`/portal/${slug}/tickets`} style={{ textDecoration:'none' }}>
                <div className="pcard pcard-hover" style={{ padding:'13px 16px' }}>
                  <div style={{ fontSize:'24px', fontWeight:'800', color:c, lineHeight:1, marginBottom:'3px', fontVariantNumeric:'tabular-nums' }}>{n}</div>
                  <div style={{ fontSize:'11px', fontWeight:'700', color:'#18130e', marginBottom:'1px' }}>{l}</div>
                  <div style={{ fontSize:'10px', color:'#8c857e' }}>{s}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* ── Main layout ── */}
          <div className="pw-dash">

            {/* Left col */}
            <div style={{ display:'flex', flexDirection:'column', gap:'14px', minWidth:0 }}>

              {/* Active tickets */}
              <div className="pcard" style={{ overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:'1px solid #e0ddd8' }}>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:'700', color:'#18130e' }}>Requerimientos activos</div>
                    <div style={{ fontSize:'11px', color:'#8c857e', marginTop:'1px' }}>{act.length} en curso</div>
                  </div>
                  <Link href={`/portal/${slug}/tickets`} style={{ fontSize:'12px', fontWeight:'700', color:acc, textDecoration:'none' }}>Ver todos →</Link>
                </div>

                {act.length === 0 ? (
                  <div className="pempty">
                    <div className="pempty-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div className="pempty-title">Sin requerimientos activos</div>
                    <div className="pempty-sub">Todo al día. <Link href={`/portal/${slug}/tickets/new`} style={{ color:acc, fontWeight:'600' }}>Crear uno →</Link></div>
                  </div>
                ) : act.slice(0,10).map((t, i) => {
                  const urgColor = URG_COLOR[t.urgency] ?? '#ccc'
                  const daysLeft = t.estimatedDate ? daysBetween(String(t.estimatedDate)) : null
                  const overdue  = daysLeft !== null && daysLeft < 0
                  const assigneeName = t.assignedTo?.name?.split(' ')[0]

                  return (
                    <Link key={t.id} href={`/portal/${slug}/tickets/${t.id}`}
                      className="trow"
                      style={{
                        display:'block', padding:'12px 18px',
                        borderBottom: i < Math.min(act.length,10)-1 ? '1px solid #e0ddd8' : 'none',
                        textDecoration:'none',
                      }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
                        {/* Urgency bar */}
                        <div style={{ width:'3px', height:'auto', alignSelf:'stretch', borderRadius:'2px', background:urgColor, flexShrink:0, minHeight:'40px' }} />

                        {/* Content */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                            <div style={{ minWidth:0, flex:1 }}>
                              <div style={{ fontSize:'13px', fontWeight:'600', color:'#18130e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {t.title}
                              </div>
                              {t.description && (
                                <div style={{ fontSize:'11px', color:'#8c857e', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {t.description}
                                </div>
                              )}
                              <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:'6px', marginTop:'5px' }}>
                                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'10px', color:'#beb7b0' }}>{t.ticketCode}</span>
                                {t.branch && <span style={{ fontSize:'10px', color:'#8c857e' }}>· {t.branch.name}</span>}
                                {t.category && CATEGORY_LABELS[t.category] && (
                                  <span style={{ fontSize:'10px', fontWeight:'600', padding:'1px 6px', borderRadius:'4px', background:'#f0f0f0', color:'#4b4540' }}>
                                    {CATEGORY_LABELS[t.category]}
                                  </span>
                                )}
                                {assigneeName && (
                                  <span style={{ fontSize:'10px', color:'#8c857e' }}>
                                    <span style={{ color:'#beb7b0' }}>Asignado:</span> {assigneeName}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Right meta */}
                            <div style={{ textAlign:'right', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' }}>
                              <span className={SB[t.status] ?? 'badge'} style={{ fontSize:'10px' }}>{SL[t.status] ?? t.status}</span>
                              {daysLeft !== null && (
                                <div style={{ fontSize:'10px', color: overdue ? '#ef4444' : '#8c857e', fontWeight: overdue ? 700 : 400 }}>
                                  {overdue ? `${Math.abs(daysLeft)}d vencido` : daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
                                </div>
                              )}
                              <div style={{ fontSize:'10px', color:'#beb7b0' }}>{timeAgo(String(t.createdAt))}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}

                {act.length > 10 && (
                  <div style={{ padding:'11px 18px', borderTop:'1px solid #e0ddd8', textAlign:'center' }}>
                    <Link href={`/portal/${slug}/tickets`} style={{ fontSize:'12px', fontWeight:'700', color:acc, textDecoration:'none' }}>
                      Ver {act.length - 10} más →
                    </Link>
                  </div>
                )}
              </div>

              {/* Resolved recently */}
              {resMes.length > 0 && (
                <div className="pcard" style={{ overflow:'hidden' }}>
                  <div style={{ padding:'13px 18px 11px', borderBottom:'1px solid #e0ddd8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:'13px', fontWeight:'700', color:'#18130e' }}>Resueltos este mes</div>
                    <span style={{ fontSize:'12px', fontWeight:'700', color:C.success }}>{resMes.length}</span>
                  </div>
                  {resMes.slice(0,5).map((t, i) => (
                    <Link key={t.id} href={`/portal/${slug}/tickets/${t.id}`}
                      className="trow"
                      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 18px', borderBottom: i<Math.min(resMes.length,5)-1?'1px solid #e0ddd8':'none', textDecoration:'none' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:C.success, flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:'12px', fontWeight:'600', color:'#18130e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                        {t.branch && <div style={{ fontSize:'11px', color:'#8c857e' }}>{t.branch.name}</div>}
                      </div>
                      <span style={{ fontSize:'10px', color:'#8c857e', flexShrink:0 }}>{timeAgo(t.closedDate ? String(t.closedDate) : String(t.createdAt))}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

              {/* Quick actions */}
              <div className="pcard" style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#8c857e', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'1.2px' }}>Acciones rápidas</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  <Link href={`/portal/${slug}/tickets/new`} className="pbtn pbtn-primary" style={{ textDecoration:'none', justifyContent:'center' }}>
                    + Nueva solicitud
                  </Link>
                  <Link href={`/portal/${slug}/tickets`} className="pbtn pbtn-ghost" style={{ textDecoration:'none', justifyContent:'center' }}>
                    Todos los tickets
                  </Link>
                  <Link href={`/portal/${slug}/informes`} className="pbtn pbtn-ghost" style={{ textDecoration:'none', justifyContent:'center' }}>
                    Informes técnicos
                  </Link>
                </div>
              </div>

              {/* 6-month mini chart */}
              <div className="pcard" style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#18130e' }}>Solicitudes / 6 meses</div>
                  <div style={{ display:'flex', gap:'8px', fontSize:'10px', color:'#8c857e' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:'3px' }}>
                      <span style={{ width:6, height:6, borderRadius:'2px', background:acc, display:'inline-block' }}/>Activos
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:'3px' }}>
                      <span style={{ width:6, height:6, borderRadius:'2px', background:C.success, display:'inline-block' }}/>Resueltos
                    </span>
                  </div>
                </div>
                <MiniBar months={months} acc={acc} />
                <div style={{ marginTop:'10px', display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#8c857e' }}>
                  <span>Total 6m: <strong style={{ color:'#18130e' }}>{months.reduce((a,m)=>a+m.total,0)}</strong></span>
                  <span>Este mes: <strong style={{ color:'#18130e' }}>{months[5]?.total ?? 0}</strong></span>
                </div>
              </div>

              {/* Branch breakdown */}
              {branchList.length > 0 && (
                <div className="pcard" style={{ padding:'14px 16px' }}>
                  <div style={{ fontSize:'10px', fontWeight:'700', color:'#8c857e', marginBottom:'12px', textTransform:'uppercase', letterSpacing:'1.2px' }}>
                    Por sucursal <span style={{ float:'right', color:'#beb7b0', fontWeight:'600' }}>{sucursales}</span>
                  </div>
                  {branchList.map(([name, count]) => (
                    <div key={name} style={{ marginBottom:'9px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px' }}>
                        <span style={{ color:'#18130e', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'150px' }}>{name}</span>
                        <span style={{ color:'#8c857e', fontWeight:'700', flexShrink:0 }}>{count}</span>
                      </div>
                      <div style={{ height:'4px', background:'#efedea', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ height:'100%', background:acc, borderRadius:'4px', width:`${(count/maxBranch)*100}%`, opacity:0.85 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary stats */}
              <div className="pcard" style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#8c857e', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'1.2px' }}>Resumen total</div>
                {[
                  { l:'Total solicitudes', v: tickets.length, bold: true },
                  { l:'Activas',           v: act.length, c: act.length>0 ? acc : undefined },
                  { l:'Resueltas',         v: tickets.filter(t=>t.status==='resuelto').length, c: C.success },
                  { l:'Canceladas',        v: tickets.filter(t=>t.status==='cancelado').length },
                ].map(({l,v,bold,c}) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #e0ddd8', fontSize:'12px' }}>
                    <span style={{ color:'#8c857e' }}>{l}</span>
                    <span style={{ fontWeight: bold?800:700, color: c ?? '#18130e', fontVariantNumeric:'tabular-nums' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PortalShell>
    </>
  )
}
