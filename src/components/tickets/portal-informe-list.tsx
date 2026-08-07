'use client'

import { useState, useMemo } from 'react'
import { resolveInformeUrl } from '@/lib/reports/resolve-informe-url'
import { PortalDocumentPreviewModal } from './portal-document-preview'

interface InformeDoc {
  id: string
  title: string
  createdAt: string
  createdByName: string
  workOrder: string
  branch: string
  reportId: string
  ticketCode: string
}

interface Props {
  docs: InformeDoc[]
  slug: string
  primary: string
  bg?: string
  cardBg?: string
  textColor?: string
}

// ── Design tokens (mismo palette que portal-ticket-list.tsx — hardcoded,
// nunca CSS vars, ver frontend.md) ──
const C = {
  bd: '#e0ddd8', bd2: '#ccc8c2', t2: '#4b4540', t3: '#8c857e', t4: '#beb7b0',
  r: '6px', r2: '10px', sh: '0 1px 3px rgba(0,0,0,0.07)', sh2: '0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
}

function IconPdf() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
      <path d="M10 2v3h3"/>
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8M5 7l3 3 3-3"/><path d="M2 13h12"/>
    </svg>
  )
}

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function daysAgoStr(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function datePart(s: string) { return String(s).substring(0, 10) }
type Preset = ''|'today'|'week'|'month'

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

function PillBtn({ label, active, onClick, cardBg, primary }: { label: string; active: boolean; onClick: () => void; cardBg: string; primary: string }) {
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

// Acciones Ver/Descargar por fila -- comparten resolveInformeUrl (misma
// lógica que portal-informe-btn.tsx, sin duplicarla) y ZIP masivo abajo
// hace su propia resolución server-side por separado (no puede reusar esto,
// vive en el endpoint, no en el navegador).
function RowActions({ docId, title, primary }: { docId: string; title: string; primary: string }) {
  const [loading, setLoading] = useState<'ver' | 'descargar' | null>(null)
  const [err, setErr] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

  async function handleVer() {
    setLoading('ver'); setErr('')
    try { setPreviewUrl(await resolveInformeUrl(docId)) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Error al cargar') }
    finally { setLoading(null) }
  }
  async function handleDownload() {
    setLoading('descargar'); setErr('')
    try {
      const url = await resolveInformeUrl(docId)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Error al descargar') }
    finally { setLoading(null) }
  }

  return (
    <div style={{ flexShrink: 0, textAlign: 'right' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={handleVer} disabled={loading !== null} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8,
          background: 'none', border: `1px solid ${primary}4d`, color: primary,
          fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: loading !== null ? 'not-allowed' : 'pointer',
        }}>
          <IconPdf />{loading === 'ver' ? 'Cargando…' : 'Ver'}
        </button>
        <button onClick={handleDownload} disabled={loading !== null} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
          background: loading !== null ? '#f3f4f6' : primary, color: loading !== null ? C.t3 : '#fff',
          border: 'none', cursor: loading !== null ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
        }}>
          <IconDownload />{loading === 'descargar' ? 'Generando…' : 'Descargar'}
        </button>
      </div>
      {err && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{err}</p>}
      {previewUrl && (
        <PortalDocumentPreviewModal
          open={!!previewUrl}
          onClose={() => { if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
          url={previewUrl}
          name={filename}
          accent={primary}
        />
      )}
    </div>
  )
}

export function PortalInformeList({ docs, primary, bg = '#f4f3f1', cardBg = '#ffffff', textColor = '#18130e' }: Props) {
  const [q, setQ] = useState('')
  const [branches, setBr] = useState<Set<string>>(new Set())
  const [preset, setPr] = useState<Preset>('')
  const [desde, setDe] = useState('')
  const [hasta, setHa] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')

  const allBranches = useMemo(() => [...new Set(docs.map(d => d.branch).filter(Boolean))].sort(), [docs])

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (preset === 'today') arr = arr.filter(d => datePart(d.createdAt) === todayStr())
    if (preset === 'week')  arr = arr.filter(d => datePart(d.createdAt) >= daysAgoStr(7))
    if (preset === 'month') arr = arr.filter(d => datePart(d.createdAt) >= daysAgoStr(30))
    if (desde) arr = arr.filter(d => datePart(d.createdAt) >= desde)
    if (hasta) arr = arr.filter(d => datePart(d.createdAt) <= hasta)
    if (branches.size) arr = arr.filter(d => branches.has(d.branch))
    if (q) {
      const lq = q.toLowerCase()
      arr = arr.filter(d =>
        d.title.toLowerCase().includes(lq) ||
        d.reportId.toLowerCase().includes(lq) ||
        d.ticketCode.toLowerCase().includes(lq) ||
        d.workOrder.toLowerCase().includes(lq) ||
        d.branch.toLowerCase().includes(lq),
      )
    }
    return arr
  }, [docs, q, branches, preset, desde, hasta])

  function toggleSet<T>(set: Set<T>, val: T) { const n = new Set(set); n.has(val) ? n.delete(val) : n.add(val); return n }
  function clearAll() { setQ(''); setBr(new Set()); setPr(''); setDe(''); setHa('') }
  const hasFilters = q || branches.size || preset || desde || hasta

  function toggleSelected(id: string) { setSelected(prev => toggleSet(prev, id)) }
  // Comparar por membresía real, no por tamaño -- ver nota en proposals-table.tsx
  // (bug real ya encontrado ahí: un id fantasma tras eliminar+refresh puede
  // hacer que los tamaños coincidan por casualidad).
  const allVisibleSelected = filtered.length > 0 && filtered.every(d => selected.has(d.id))
  function toggleSelectAll() {
    setSelected(prev => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        filtered.forEach(d => next.delete(d.id))
        return next
      }
      const next = new Set(prev)
      filtered.forEach(d => next.add(d.id))
      return next
    })
  }

  async function downloadSelectedZip() {
    setBulkBusy(true); setBulkError('')
    try {
      const res = await fetch('/api/portal/informes/zip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status} al generar el ZIP`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'Informes.zip'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Error al descargar el ZIP')
    } finally {
      setBulkBusy(false)
    }
  }

  if (docs.length === 0) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: cardBg, border: `1px solid ${C.bd}`, borderRadius: 16, boxShadow: C.sh, padding: '52px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: textColor, marginBottom: 6 }}>Sin informes técnicos aún</div>
          <div style={{ fontSize: 13, color: C.t3 }}>
            Cuando INGEGAR genere informes técnicos para tu empresa, aparecerán aquí.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header strip */}
      <div style={{
        background: `linear-gradient(135deg, ${primary} 0%, color-mix(in srgb, ${primary} 60%, #000) 100%)`,
        borderRadius: 14, padding: '16px 20px', marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
            <path d="M10 2v3h3M5 8h6M5 11h4"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Informes Técnicos</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {docs.length} informe{docs.length !== 1 ? 's' : ''} · emitidos por INGEGAR
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: cardBg, border: `1px solid ${C.bd}`, borderRadius: 12, padding: '12px 16px', marginBottom: 10, boxShadow: C.sh }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.t3, pointerEvents: 'none' }}
              width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por informe, ticket, OT o sucursal…" style={{
              width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
              border: `1px solid ${C.bd2}`, borderRadius: C.r, fontSize: 13, background: bg,
              color: textColor, outline: 'none', fontFamily: 'inherit', minHeight: 44,
            }} />
          </div>
          {allBranches.length > 1 && (
            <FilterDropdown label="Sucursal" options={allBranches.map(b => ({ v: b, l: b }))} selected={branches} onChange={v => setBr(toggleSet(branches, v))} primary={primary} cardBg={cardBg} textColor={textColor} bg={bg} />
          )}
          {hasFilters && <button onClick={clearAll} style={{ padding: '6px 10px', borderRadius: C.r, border: `1px solid ${C.bd2}`, background: cardBg, color: C.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36, whiteSpace: 'nowrap' }}>× Limpiar</button>}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <PillBtn label="Todo" active={!preset && !desde && !hasta} onClick={() => { setPr(''); setDe(''); setHa('') }} cardBg={cardBg} primary={primary} />
          <PillBtn label="Hoy" active={preset === 'today'} onClick={() => { setPr('today'); setDe(''); setHa('') }} cardBg={cardBg} primary={primary} />
          <PillBtn label="7 días" active={preset === 'week'} onClick={() => { setPr('week'); setDe(''); setHa('') }} cardBg={cardBg} primary={primary} />
          <PillBtn label="30 días" active={preset === 'month'} onClick={() => { setPr('month'); setDe(''); setHa('') }} cardBg={cardBg} primary={primary} />
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

      {/* Count + select-visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.t2, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} style={{ accentColor: primary, width: 14, height: 14, cursor: 'pointer' }} />
          Seleccionar visibles
        </label>
        <div style={{ fontSize: 11, color: C.t3, fontWeight: 600 }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          {hasFilters && <span style={{ marginLeft: 6, color: primary, cursor: 'pointer', fontWeight: 700 }} onClick={clearAll}>· Limpiar filtros</span>}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: `${primary}12`, border: `1px solid ${primary}40`, borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
          <strong style={{ fontSize: 12, color: textColor }}>{selected.size} seleccionado{selected.size !== 1 ? 's' : ''}</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {bulkError && <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>{bulkError}</span>}
            <button onClick={downloadSelectedZip} disabled={bulkBusy} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
              background: bulkBusy ? '#f3f4f6' : primary, color: bulkBusy ? C.t3 : '#fff',
              border: 'none', cursor: bulkBusy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            }}>
              {bulkBusy ? 'Generando ZIP…' : 'Descargar ZIP'}
            </button>
            <button onClick={() => { setSelected(new Set()); setBulkError('') }} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${C.bd2}`, background: cardBg, color: C.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Limpiar selección
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ background: cardBg, border: `1px solid ${C.bd}`, borderRadius: 12, boxShadow: C.sh, padding: '48px 24px', textAlign: 'center', color: C.t3, fontSize: 14 }}>
          Sin resultados para los filtros seleccionados.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((doc, i) => (
            <div key={doc.id} style={{
              background: cardBg, border: `1px solid ${selected.has(doc.id) ? primary : C.bd}`,
              borderRadius: 14, boxShadow: C.sh, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, minWidth: 24, minHeight: 44, cursor: 'pointer' }}>
                <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggleSelected(doc.id)}
                  style={{ width: 16, height: 16, accentColor: primary, cursor: 'pointer' }}
                  aria-label={`Seleccionar ${doc.title}`} />
              </label>

              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${primary}18`, display: 'grid', placeItems: 'center',
                fontSize: 13, fontWeight: 800, color: primary,
              }}>
                {filtered.length - i}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: textColor, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.title}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: C.t3 }}>
                  <span>
                    📅 {new Date(doc.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {doc.workOrder && <span>🔧 OT: {doc.workOrder}</span>}
                  {doc.branch && <span>📍 {doc.branch}</span>}
                  {doc.ticketCode && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{doc.ticketCode}</span>}
                  {doc.reportId && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>#{doc.reportId}</span>}
                  <span>por {doc.createdByName}</span>
                </div>
              </div>

              <RowActions docId={doc.id} title={doc.title} primary={primary} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
