'use client'

import { useState, useMemo } from 'react'

export interface PortalTicket {
  id: string
  ticketCode: string
  title: string
  status: string
  urgency: string
  createdAt: string
  estimatedDate: string | null
  closedDate: string | null
  branch: { id: string; name: string } | null
  assignedTo: { id: string; name: string } | null
  _count: { items: number; documents: number }
}

interface Props {
  tickets: PortalTicket[]
  slug: string
  primary: string
  bg?: string
  cardBg?: string
  textColor?: string
  isAdmin?: boolean
}

// ── Design tokens (hardcoded — never depend on CSS vars) ──
const C = {
  bg:    '#f4f3f1',
  card:  '#ffffff',
  bd:    '#e0ddd8',
  bd2:   '#ccc8c2',
  tx:    '#18130e',
  t2:    '#4b4540',
  t3:    '#8c857e',
  t4:    '#beb7b0',
  r:     '6px',
  r2:    '10px',
  sh:    '0 1px 3px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.04)',
  sh2:   '0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
}

const STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', en_revision: 'En revisión', en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esp. aprobación', resuelto: 'Resuelto', cancelado: 'Cancelado',
}
const URG_LABEL: Record<string, string> = {
  emergencia: 'Emergencia', urgencia: 'Urgente', no_urgente: 'Normal', preventivo: 'Preventivo',
}
const URG_COLOR: Record<string, string> = {
  emergencia: '#ef4444', urgencia: '#f59e0b', no_urgente: '#22c55e', preventivo: '#3b82f6',
}

// Status/urgency — dot + label (no colored background)
const STATUS_DOT_COLOR: Record<string, string> = {
  nuevo:                '#3b82f6',
  en_revision:          '#f59e0b',
  en_ejecucion:         '#f97316',
  esperando_aprobacion: '#8b5cf6',
  resuelto:             '#22c55e',
  cancelado:            '#9ca3af',
}
const URG_DOT_COLOR: Record<string, string> = {
  emergencia: '#ef4444',
  urgencia:   '#f97316',
  no_urgente: '#22c55e',
  preventivo: '#3b82f6',
}

function StatusDot({ s }: { s: string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:C.t2, whiteSpace:'nowrap' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:STATUS_DOT_COLOR[s]??'#ccc', flexShrink:0, display:'inline-block' }}/>
      {STATUS_LABEL[s]??s}
    </span>
  )
}
function UrgDot({ u }: { u: string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:C.t2, whiteSpace:'nowrap' }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:URG_DOT_COLOR[u]??'#ccc', flexShrink:0, display:'inline-block' }}/>
      {URG_LABEL[u]??u}
    </span>
  )
}

const OPEN = ['nuevo','en_revision','en_ejecucion','esperando_aprobacion']

function daysBetween(d: string) { return Math.floor((new Date(d).getTime() - Date.now()) / 86400000) }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function daysAgoStr(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function datePart(s: string) { return String(s).substring(0, 10) }

type Preset = ''|'today'|'yesterday'|'week'|'month'
type Grupo  = ''|'abiertos'|'cerrados'|'vencidos'

function FilterDropdown({ label, options, selected, onChange, primary, cardBg, textColor, bg }: {
  label: string; options: {v:string;l:string}[]; selected: Set<string>; onChange: (v:string)=>void
  primary: string; cardBg: string; textColor: string; bg: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 10px', borderRadius: C.r,
        border: `1px solid ${selected.size ? primary : C.bd2}`,
        background: selected.size ? `${primary}18` : cardBg,
        color: selected.size ? primary : C.t2,
        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
      }}>
        {label}
        {selected.size > 0 && <span style={{ background: primary, color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, display: 'grid', placeItems: 'center', fontWeight: 700 }}>{selected.size}</span>}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100, background: cardBg, border: `1px solid ${C.bd}`, borderRadius: C.r2, boxShadow: C.sh2, minWidth: 160, overflow: 'hidden' }}>
          {options.map(({ v, l }) => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', fontSize: 12, color: textColor, borderBottom: `1px solid ${C.bd}`, background: cardBg }}>
              <input type="checkbox" checked={selected.has(v)} onChange={() => onChange(v)} style={{ accentColor: primary, width: 14, height: 14 }} />
              {l}
            </label>
          ))}
          <div style={{ padding: '6px 8px', display: 'flex', gap: 4, background: cardBg }}>
            <button onClick={() => { options.forEach(o => onChange(o.v)); setOpen(false) }}
              style={{ flex: 1, padding: 4, fontSize: 11, background: bg, border: `1px solid ${C.bd}`, borderRadius: C.r, cursor: 'pointer', fontFamily: 'inherit', color: C.t2 }}>Todos</button>
            <button onClick={() => { selected.forEach(v => onChange(v)); setOpen(false) }}
              style={{ flex: 1, padding: 4, fontSize: 11, background: bg, border: `1px solid ${C.bd}`, borderRadius: C.r, cursor: 'pointer', fontFamily: 'inherit', color: C.t2 }}>Ninguno</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PortalTicketList({ tickets, slug, primary, bg = C.bg, cardBg = C.card, textColor = C.tx, isAdmin }: Props) {
  const [q, setQ]           = useState('')
  const [statuses, setSt]   = useState<Set<string>>(new Set())
  const [urgencies, setUr]  = useState<Set<string>>(new Set())
  const [branches, setBr]   = useState<Set<string>>(new Set())
  const [preset, setPr]     = useState<Preset>('')
  const [grupo, setGr]      = useState<Grupo>('')
  const [desde, setDe]      = useState('')
  const [hasta, setHa]      = useState('')

  const allBranches = useMemo(() => [...new Set(tickets.map(t => t.branch?.name).filter(Boolean) as string[])].sort(), [tickets])
  const allStatuses = useMemo(() => [...new Set(tickets.map(t => t.status))].filter(s => s !== 'fusionado'), [tickets])

  const filtered = useMemo(() => {
    let arr = [...tickets]
    const today = todayStr(), yesterday = daysAgoStr(1)
    if (preset === 'today')     arr = arr.filter(t => datePart(t.createdAt) === today)
    if (preset === 'yesterday') arr = arr.filter(t => datePart(t.createdAt) === yesterday)
    if (preset === 'week')      arr = arr.filter(t => datePart(t.createdAt) >= daysAgoStr(7))
    if (preset === 'month')     arr = arr.filter(t => datePart(t.createdAt) >= daysAgoStr(30))
    if (grupo === 'abiertos')   arr = arr.filter(t => OPEN.includes(t.status))
    if (grupo === 'cerrados')   arr = arr.filter(t => ['resuelto','cancelado'].includes(t.status))
    if (grupo === 'vencidos')   arr = arr.filter(t => t.estimatedDate && daysBetween(t.estimatedDate) < 0 && OPEN.includes(t.status))
    if (statuses.size)  arr = arr.filter(t => statuses.has(t.status))
    if (urgencies.size) arr = arr.filter(t => urgencies.has(t.urgency))
    if (branches.size)  arr = arr.filter(t => t.branch && branches.has(t.branch.name))
    if (desde) arr = arr.filter(t => datePart(t.createdAt) >= desde)
    if (hasta) arr = arr.filter(t => datePart(t.createdAt) <= hasta)
    if (q) { const lq = q.toLowerCase(); arr = arr.filter(t => t.ticketCode.toLowerCase().includes(lq) || t.title.toLowerCase().includes(lq) || (t.branch?.name ?? '').toLowerCase().includes(lq)) }
    return arr
  }, [tickets, q, statuses, urgencies, branches, preset, grupo, desde, hasta])

  function toggleSet<T>(set: Set<T>, val: T) { const n = new Set(set); n.has(val) ? n.delete(val) : n.add(val); return n }
  function clearAll() { setQ(''); setSt(new Set()); setUr(new Set()); setBr(new Set()); setPr(''); setGr(''); setDe(''); setHa('') }
  const hasFilters = q || statuses.size || urgencies.size || branches.size || preset || grupo || desde || hasta

  // ── Sub-components ──
  function PillBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    const [hov, setHov] = useState(false)
    return (
      <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
        padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
        border: `1px solid ${active ? primary : C.bd2}`,
        background: active ? primary : hov ? C.bd : cardBg,
        color: active ? '#fff' : C.t2,
        cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
      }}>{label}</button>
    )
  }

  return (
    <div style={{ padding: '20px 22px', background: bg, color: textColor, minHeight: '100%' }}>

      {/* ── Filter bar ── */}
      <div style={{ background: cardBg, border: `1px solid ${C.bd}`, borderRadius: 12, padding: '12px 16px', marginBottom: 12, boxShadow: C.sh }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 280 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.t3, pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar ID, título, sucursal…" style={{
              width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
              border: `1px solid ${C.bd2}`, borderRadius: C.r, fontSize: 12, background: bg,
              color: textColor, outline: 'none', fontFamily: 'inherit',
            }} />
          </div>
          <FilterDropdown label="Estado"   options={allStatuses.map(s => ({ v: s, l: STATUS_LABEL[s] ?? s }))} selected={statuses}  onChange={v => setSt(toggleSet(statuses, v))} primary={primary} cardBg={cardBg} textColor={textColor} bg={bg} />
          <FilterDropdown label="Urgencia" options={[{v:'emergencia',l:'Emergencia'},{v:'urgencia',l:'Urgente'},{v:'no_urgente',l:'Normal'},{v:'preventivo',l:'Preventivo'}]} selected={urgencies} onChange={v => setUr(toggleSet(urgencies, v))} primary={primary} cardBg={cardBg} textColor={textColor} bg={bg} />
          {allBranches.length > 1 && <FilterDropdown label="Sucursal" options={allBranches.map(b => ({ v: b, l: b }))} selected={branches} onChange={v => setBr(toggleSet(branches, v))} primary={primary} cardBg={cardBg} textColor={textColor} bg={bg} />}
          {hasFilters && <button onClick={clearAll} style={{ padding: '6px 10px', borderRadius: C.r, border: `1px solid ${C.bd2}`, background: cardBg, color: C.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>× Limpiar</button>}
        </div>

        {/* Pills + date range */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { l:'Todo',    v:'' as Preset,      fn: () => { setPr(''); setDe(''); setHa(''); setGr('') }, active: !preset && !desde && !hasta && !grupo },
            { l:'Hoy',     v:'today' as Preset,     fn: () => { setPr('today');     setDe(''); setHa(''); setGr('') }, active: preset==='today' },
            { l:'Ayer',    v:'yesterday' as Preset,  fn: () => { setPr('yesterday'); setDe(''); setHa(''); setGr('') }, active: preset==='yesterday' },
            { l:'7 días',  v:'week' as Preset,      fn: () => { setPr('week');      setDe(''); setHa(''); setGr('') }, active: preset==='week' },
            { l:'30 días', v:'month' as Preset,     fn: () => { setPr('month');     setDe(''); setHa(''); setGr('') }, active: preset==='month' },
          ].map(p => <PillBtn key={p.l} label={p.l} active={p.active} onClick={p.fn} />)}
          <div style={{ width: 1, height: 16, background: C.bd, margin: '0 3px' }} />
          {[
            { l:'Abiertos', g:'abiertos' as Grupo },
            { l:'Cerrados', g:'cerrados' as Grupo },
            { l:'Vencidos', g:'vencidos' as Grupo },
          ].map(p => <PillBtn key={p.l} label={p.l} active={grupo===p.g} onClick={() => { setGr(grupo===p.g ? '' : p.g); setPr('') }} />)}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: C.t3 }}>Desde</span>
            <input type="date" value={desde} onChange={e => { setDe(e.target.value); setPr('') }}
              style={{ padding: '4px 7px', fontSize: 11, border: `1px solid ${C.bd2}`, borderRadius: C.r, background: cardBg, color: textColor, fontFamily: 'inherit', width: 128 }} />
            <span style={{ fontSize: 11, color: C.t3 }}>Hasta</span>
            <input type="date" value={hasta} onChange={e => { setHa(e.target.value); setPr('') }}
              style={{ padding: '4px 7px', fontSize: 11, border: `1px solid ${C.bd2}`, borderRadius: C.r, background: cardBg, color: textColor, fontFamily: 'inherit', width: 128 }} />
            {(desde || hasta) && <button onClick={() => { setDe(''); setHa('') }} style={{ padding: '4px 7px', border: `1px solid ${C.bd2}`, borderRadius: C.r, background: cardBg, cursor: 'pointer', fontSize: 12, color: C.t3, fontFamily: 'inherit' }}>×</button>}
          </div>
        </div>
      </div>

      {/* Count */}
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 8, fontWeight: 600 }}>
        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        {hasFilters && <span style={{ marginLeft: 6, color: primary, cursor: 'pointer', fontWeight: 700 }} onClick={clearAll}>· Limpiar filtros</span>}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{ background: cardBg, border: `1px solid ${C.bd}`, borderRadius: 12, boxShadow: C.sh, padding: '48px 24px', textAlign: 'center', color: C.t3, fontSize: 14 }}>
          Sin resultados para los filtros seleccionados.
        </div>
      ) : (
        <>
          {/* Mobile cards — hidden on md+ */}
          <div className="flex flex-col md:hidden" style={{ gap: 8 }}>
            {filtered.map(t => {
              const isOpen = OPEN.includes(t.status)
              const overdue = t.estimatedDate && daysBetween(t.estimatedDate) < 0 && isOpen
              return (
                <a key={t.id} href={`/portal/${slug}/tickets/${t.id}`}
                  style={{ display: 'block', background: cardBg, border: `1px solid ${C.bd}`, borderLeft: `4px solid ${URG_COLOR[t.urgency] ?? C.bd}`, borderRadius: 12, padding: '12px 14px', textDecoration: 'none', boxShadow: C.sh }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.title}</div>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: C.bd2, flexShrink: 0, marginTop: 2 }}><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', fontSize: 11 }}>
                    <StatusDot s={t.status} />
                    <UrgDot u={t.urgency} />
                    {t.branch && <span style={{ color: C.t3 }}>{t.branch.name}</span>}
                    {t.assignedTo && <span style={{ color: C.t3 }}>Téc: {t.assignedTo.name.split(' ')[0]}</span>}
                    <span style={{ marginLeft: 'auto', color: C.t4, fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{t.ticketCode}</span>
                  </div>
                  {overdue && (
                    <div style={{ marginTop: 5, fontSize: 10, fontWeight: 700, color: '#ef4444' }}>{Math.abs(daysBetween(t.estimatedDate!))}d vencido</div>
                  )}
                </a>
              )
            })}
          </div>

          {/* Desktop table — hidden on mobile */}
          <div className="hidden md:block" style={{ background: cardBg, border: `1px solid ${C.bd}`, borderRadius: 12, boxShadow: C.sh, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.bd}`, background: bg }}>
                    {['ID','Título','Sucursal','Urgencia','Estado','Docs','Fecha'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => {
                    const isOpen = OPEN.includes(t.status)
                    const overdue = t.estimatedDate && daysBetween(t.estimatedDate) < 0 && isOpen
                    return (
                      <tr key={t.id}
                        onClick={() => window.location.href = `/portal/${slug}/tickets/${t.id}`}
                        style={{ borderBottom: i < filtered.length-1 ? `1px solid ${C.bd}` : 'none', cursor: 'pointer', borderLeft: `3px solid ${URG_COLOR[t.urgency] ?? 'transparent'}`, background: cardBg }}
                        onMouseEnter={e => (e.currentTarget.style.background = bg)}
                        onMouseLeave={e => (e.currentTarget.style.background = cardBg)}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: C.t3 }}>{t.ticketCode}</span>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                          {t.assignedTo && <div style={{ fontSize: 11, color: C.t3, marginTop: 1 }}>Téc: {t.assignedTo.name}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: C.t2, whiteSpace: 'nowrap' }}>{t.branch?.name ?? '—'}</td>
                        <td style={{ padding: '10px 14px' }}><UrgDot u={t.urgency} /></td>
                        <td style={{ padding: '10px 14px' }}><StatusDot s={t.status} /></td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {(t._count.documents > 0 || t._count.items > 0) ? (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
                              {t._count.documents > 0 && (
                                <span title={`${t._count.documents} adjunto${t._count.documents !== 1 ? 's' : ''}`}
                                  style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: C.t2, background: bg, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '1px 7px' }}>
                                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2H3a1 1 0 00-1 1v7a1 1 0 001 1h6a1 1 0 001-1V5L7 2z"/><path d="M7 2v3h3M4 7h4M4 9h2"/></svg>
                                  {t._count.documents}
                                </span>
                              )}
                              {t._count.items > 0 && (
                                <span title={`${t._count.items} ítem${t._count.items !== 1 ? 's' : ''}`}
                                  style={{ fontSize: 11, fontWeight: 600, color: C.t2, background: bg, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '1px 7px' }}>
                                  ☑ {t._count.items}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: C.t4, fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 11, color: C.t3 }}>{new Date(t.createdAt).toLocaleDateString('es-CL')}</div>
                          {overdue && <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>{Math.abs(daysBetween(t.estimatedDate!))}d vencido</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: C.bd2 }}><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
