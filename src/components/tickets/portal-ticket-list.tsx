'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// Minimal ticket shape passed from server
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
  isAdmin?: boolean
}

const STATUS_BADGE: Record<string, string> = {
  nuevo: 'badge badge-nuevo', en_revision: 'badge badge-revision',
  en_ejecucion: 'badge badge-ejecucion', esperando_aprobacion: 'badge badge-espera',
  resuelto: 'badge badge-resuelto', cancelado: 'badge badge-cancelado',
}
const STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', en_revision: 'En revisión', en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esp. aprobación', resuelto: 'Resuelto', cancelado: 'Cancelado',
}
const URG_BADGE: Record<string, string> = {
  emergencia: 'badge badge-em', urgencia: 'badge badge-ur', no_urgente: 'badge badge-rq', preventivo: 'badge badge-pr',
}
const URG_LABEL: Record<string, string> = {
  emergencia: 'Emergencia', urgencia: 'Urgente', no_urgente: 'Normal', preventivo: 'Preventivo',
}
const URG_COLOR: Record<string, string> = {
  emergencia: '#ef4444', urgencia: '#f59e0b', no_urgente: '#22c55e', preventivo: '#3b82f6',
}
const OPEN = ['nuevo','en_revision','en_ejecucion','esperando_aprobacion']

function daysBetween(dateStr: string) {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

type Preset = ''|'today'|'yesterday'|'week'|'month'
type Grupo = ''|'abiertos'|'cerrados'|'vencidos'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function daysAgoStr(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function getDatePart(dateStr: string) {
  return String(dateStr).substring(0, 10)
}

export function PortalTicketList({ tickets, slug, primary, isAdmin }: Props) {
  const [q, setQ] = useState('')
  const [statuses, setStatuses] = useState<Set<string>>(new Set())
  const [urgencies, setUrgencies] = useState<Set<string>>(new Set())
  const [branches, setBranches] = useState<Set<string>>(new Set())
  const [preset, setPreset] = useState<Preset>('')
  const [grupo, setGrupo] = useState<Grupo>('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const allBranches = useMemo(() =>
    [...new Set(tickets.map(t => t.branch?.name).filter(Boolean) as string[])].sort()
  , [tickets])

  const allStatuses = useMemo(() =>
    [...new Set(tickets.map(t => t.status))].filter(s => s !== 'fusionado')
  , [tickets])

  const filtered = useMemo(() => {
    let arr = [...tickets]
    // Date presets
    const today = todayStr()
    const yesterday = daysAgoStr(1)
    if (preset === 'today') arr = arr.filter(t => getDatePart(t.createdAt) === today)
    else if (preset === 'yesterday') arr = arr.filter(t => getDatePart(t.createdAt) === yesterday)
    else if (preset === 'week') { const w = daysAgoStr(7); arr = arr.filter(t => getDatePart(t.createdAt) >= w) }
    else if (preset === 'month') { const m = daysAgoStr(30); arr = arr.filter(t => getDatePart(t.createdAt) >= m) }
    // Group filters
    if (grupo === 'abiertos') arr = arr.filter(t => OPEN.includes(t.status))
    else if (grupo === 'cerrados') arr = arr.filter(t => ['resuelto','cancelado'].includes(t.status))
    else if (grupo === 'vencidos') arr = arr.filter(t => t.estimatedDate && daysBetween(t.estimatedDate) < 0 && OPEN.includes(t.status))
    // Multi-select
    if (statuses.size) arr = arr.filter(t => statuses.has(t.status))
    if (urgencies.size) arr = arr.filter(t => urgencies.has(t.urgency))
    if (branches.size) arr = arr.filter(t => t.branch && branches.has(t.branch.name))
    // Date range
    if (desde) arr = arr.filter(t => getDatePart(t.createdAt) >= desde)
    if (hasta) arr = arr.filter(t => getDatePart(t.createdAt) <= hasta)
    // Text search
    if (q) {
      const lq = q.toLowerCase()
      arr = arr.filter(t =>
        t.ticketCode.toLowerCase().includes(lq) ||
        t.title.toLowerCase().includes(lq) ||
        (t.branch?.name ?? '').toLowerCase().includes(lq)
      )
    }
    return arr
  }, [tickets, q, statuses, urgencies, branches, preset, grupo, desde, hasta])

  function toggleSet<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set)
    next.has(val) ? next.delete(val) : next.add(val)
    return next
  }

  function clearAll() {
    setQ(''); setStatuses(new Set()); setUrgencies(new Set()); setBranches(new Set())
    setPreset(''); setGrupo(''); setDesde(''); setHasta('')
  }

  const hasFilters = q || statuses.size || urgencies.size || branches.size || preset || grupo || desde || hasta

  // Filter pill button
  const PillBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
      border: `1px solid ${active ? primary : 'var(--p-bd2)'}`,
      background: active ? `color-mix(in srgb, ${primary} 12%, white)` : 'var(--p-card)',
      color: active ? primary : 'var(--p-t2)', cursor: 'pointer', transition: 'all 0.12s',
      fontFamily: 'inherit',
    }}>
      {label}
    </button>
  )

  // Dropdown filter
  const FilterDropdown = ({ label, options, selected, onChange }: {
    label: string; options: {v:string;l:string}[];
    selected: Set<string>; onChange: (v: string) => void;
  }) => {
    const [open, setOpen] = useState(false)
    return (
      <div style={{ position: 'relative' }}>
        <button onClick={() => setOpen(!open)} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '6px 10px', borderRadius: 'var(--p-r)',
          border: `1px solid ${selected.size ? primary : 'var(--p-bd2)'}`,
          background: selected.size ? `color-mix(in srgb, ${primary} 8%, white)` : 'var(--p-card)',
          color: selected.size ? primary : 'var(--p-t2)',
          fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit',
        }}>
          {label}
          {selected.size > 0 && (
            <span style={{ background: primary, color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'grid', placeItems: 'center', fontWeight: '700' }}>
              {selected.size}
            </span>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
            background: 'var(--p-card)', border: '1px solid var(--p-bd)', borderRadius: 'var(--p-r2)',
            boxShadow: 'var(--p-sh2)', minWidth: '160px', overflow: 'hidden',
          }}>
            {options.map(({ v, l }) => (
              <label key={v} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px',
                cursor: 'pointer', fontSize: '12px', color: 'var(--p-text)',
                borderBottom: '1px solid var(--p-bd)',
              }}>
                <input type="checkbox" checked={selected.has(v)} onChange={() => onChange(v)}
                  style={{ accentColor: primary, width: '14px', height: '14px' }} />
                {l}
              </label>
            ))}
            <div style={{ padding: '6px 8px', display: 'flex', gap: '4px' }}>
              <button onClick={() => { options.forEach(o => onChange(o.v)); setOpen(false) }}
                style={{ flex: 1, padding: '4px', fontSize: '11px', background: 'var(--p-bg)', border: '1px solid var(--p-bd)', borderRadius: 'var(--p-r)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--p-t2)' }}>
                Todos
              </button>
              <button onClick={() => { selected.forEach(v => onChange(v)); setOpen(false) }}
                style={{ flex: 1, padding: '4px', fontSize: '11px', background: 'var(--p-bg)', border: '1px solid var(--p-bd)', borderRadius: 'var(--p-r)', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--p-t2)' }}>
                Ninguno
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 28px' }}>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '280px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--p-t3)' }}
            width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar ID, título, sucursal…"
            style={{ width: '100%', paddingLeft: '30px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px',
              border: '1px solid var(--p-bd2)', borderRadius: 'var(--p-r)', fontSize: '12px',
              background: 'var(--p-card)', color: 'var(--p-text)', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <FilterDropdown label="Estado" options={allStatuses.map(s => ({ v: s, l: STATUS_LABEL[s] ?? s }))}
          selected={statuses} onChange={v => setStatuses(toggleSet(statuses, v))} />
        <FilterDropdown label="Urgencia"
          options={[{v:'emergencia',l:'Emergencia'},{v:'urgencia',l:'Urgente'},{v:'no_urgente',l:'Normal'},{v:'preventivo',l:'Preventivo'}]}
          selected={urgencies} onChange={v => setUrgencies(toggleSet(urgencies, v))} />
        {allBranches.length > 1 && (
          <FilterDropdown label="Sucursal" options={allBranches.map(b => ({ v: b, l: b }))}
            selected={branches} onChange={v => setBranches(toggleSet(branches, v))} />
        )}
        {hasFilters && (
          <button onClick={clearAll} style={{
            padding: '6px 10px', borderRadius: 'var(--p-r)', border: '1px solid var(--p-bd2)',
            background: 'var(--p-card)', color: 'var(--p-t2)', fontSize: '12px', fontWeight: '600',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>× Limpiar</button>
        )}
      </div>

      {/* Preset pills + date range */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
        <PillBtn label="Todo" active={!preset && !desde && !hasta && !grupo} onClick={() => { setPreset(''); setDesde(''); setHasta(''); setGrupo('') }} />
        <PillBtn label="Hoy" active={preset === 'today'} onClick={() => { setPreset('today'); setDesde(''); setHasta(''); setGrupo('') }} />
        <PillBtn label="Ayer" active={preset === 'yesterday'} onClick={() => { setPreset('yesterday'); setDesde(''); setHasta(''); setGrupo('') }} />
        <PillBtn label="7 días" active={preset === 'week'} onClick={() => { setPreset('week'); setDesde(''); setHasta(''); setGrupo('') }} />
        <PillBtn label="30 días" active={preset === 'month'} onClick={() => { setPreset('month'); setDesde(''); setHasta(''); setGrupo('') }} />
        <div style={{ width: '1px', height: '16px', background: 'var(--p-bd)', margin: '0 3px' }} />
        <PillBtn label="Abiertos" active={grupo === 'abiertos'} onClick={() => { setGrupo(grupo==='abiertos'?'':'abiertos'); setPreset('') }} />
        <PillBtn label="Cerrados" active={grupo === 'cerrados'} onClick={() => { setGrupo(grupo==='cerrados'?'':'cerrados'); setPreset('') }} />
        <PillBtn label="Vencidos" active={grupo === 'vencidos'} onClick={() => { setGrupo(grupo==='vencidos'?'':'vencidos'); setPreset('') }} />
        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
          <label style={{ fontSize: '11px', color: 'var(--p-t3)', whiteSpace: 'nowrap' }}>Desde</label>
          <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPreset('') }}
            style={{ padding: '4px 7px', fontSize: '11px', border: '1px solid var(--p-bd2)', borderRadius: 'var(--p-r)', background: 'var(--p-card)', fontFamily: 'inherit', width: '128px' }} />
          <label style={{ fontSize: '11px', color: 'var(--p-t3)' }}>Hasta</label>
          <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPreset('') }}
            style={{ padding: '4px 7px', fontSize: '11px', border: '1px solid var(--p-bd2)', borderRadius: 'var(--p-r)', background: 'var(--p-card)', fontFamily: 'inherit', width: '128px' }} />
          {(desde || hasta) && (
            <button onClick={() => { setDesde(''); setHasta('') }} style={{ padding: '4px 6px', border: '1px solid var(--p-bd2)', borderRadius: 'var(--p-r)', background: 'var(--p-card)', cursor: 'pointer', fontSize: '12px', color: 'var(--p-t3)', fontFamily: 'inherit' }}>×</button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div style={{ fontSize: '11px', color: 'var(--p-t3)', marginBottom: '8px', fontWeight: '600' }}>
        {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        {hasFilters && <span style={{ marginLeft: '6px', color: primary, cursor: 'pointer' }} onClick={clearAll}>· Limpiar filtros</span>}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="pcard" style={{ padding: '48px', textAlign: 'center', color: 'var(--p-t3)', fontSize: '14px' }}>
          Sin resultados para los filtros seleccionados.
        </div>
      ) : (
        <div className="pcard" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--p-bd)' }}>
                  {['ID','Título','Sucursal','Urgencia','Estado','Ítems','Fecha',''].map(h => (
                    <th key={h} style={{ padding: '9px 14px', fontSize: '10px', fontWeight: '700', color: 'var(--p-t3)', textTransform: 'uppercase', letterSpacing: '0.8px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const isOpen = OPEN.includes(t.status)
                  const overdue = t.estimatedDate && daysBetween(t.estimatedDate) < 0 && isOpen
                  return (
                    <tr key={t.id}
                      onClick={() => window.location.href = `/portal/${slug}/tickets/${t.id}`}
                      style={{
                        borderBottom: i < filtered.length - 1 ? '1px solid var(--p-bd)' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                        borderLeft: `3px solid ${URG_COLOR[t.urgency] ?? 'transparent'}`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--p-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <span className="mono" style={{ fontSize: '10px', color: 'var(--p-t3)' }}>{t.ticketCode}</span>
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: '260px' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        {t.assignedTo && <div style={{ fontSize: '11px', color: 'var(--p-t3)' }}>Téc: {t.assignedTo.name}</div>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--p-t2)', whiteSpace: 'nowrap' }}>
                        {t.branch?.name ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={URG_BADGE[t.urgency] ?? 'badge'}>{URG_LABEL[t.urgency] ?? t.urgency}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={STATUS_BADGE[t.status] ?? 'badge'}>{STATUS_LABEL[t.status] ?? t.status}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {t._count.items > 0 ? (
                          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--p-t2)', background: 'var(--p-bg)', border: '1px solid var(--p-bd)', borderRadius: '10px', padding: '1px 7px' }}>
                            {t._count.items}
                          </span>
                        ) : <span style={{ color: 'var(--p-bd2)', fontSize: '11px' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '11px', color: 'var(--p-t3)' }}>{new Date(t.createdAt).toLocaleDateString('es-CL')}</div>
                        {overdue && (
                          <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: '600' }}>
                            {Math.abs(daysBetween(t.estimatedDate!))}d vencido
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--p-bd2)' }}>
                          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
