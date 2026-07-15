'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PipelineDoc } from '@/lib/pipeline/queries'
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_STATUS_ORDER,
  formatCLP,
  daysSince,
} from '@/lib/pipeline/labels'
import {
  updatePipelineStatus,
  updatePipelineAmount,
  updateFollowUp,
  removeFromPipeline,
} from '@/lib/pipeline/actions'
import type { ProposalStatus } from '@/generated/prisma/enums'

// ---------------------------------------------------------------------------
// Pill badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: ProposalStatus }) {
  const c = PROPOSAL_STATUS_COLORS[status]
  return (
    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {PROPOSAL_STATUS_LABELS[status]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Pipeline card (expandable)
// ---------------------------------------------------------------------------
function PipelineCard({ doc }: { doc: PipelineDoc }) {
  const [expanded, setExpanded] = useState(false)
  const [editAmount, setEditAmount] = useState(false)
  const [amountInput, setAmountInput] = useState(String(doc.proposalAmount ?? ''))
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState(doc.proposalNote ?? '')
  const [savingNote, setSavingNote] = useState(false)
  const router = useRouter()

  const status = doc.proposalStatus
  const colors = PROPOSAL_STATUS_COLORS[status]

  // Urgency: enviada/vista > 7 days without response
  const refDate = doc.viewedAt ?? doc.sentAt
  const stale = (status === 'enviada' || status === 'vista') && refDate && daysSince(refDate) > 7

  // Follow-up: overdue
  const followupOverdue = doc.followUpAt && new Date(doc.followUpAt) < new Date() && !['aceptada', 'rechazada', 'perdida'].includes(status)

  function changeStatus(newStatus: ProposalStatus) {
    startTransition(async () => {
      await updatePipelineStatus(doc.id, newStatus)
      router.refresh()
    })
  }

  function saveAmount() {
    const val = parseInt(amountInput.replace(/\D/g, ''), 10)
    startTransition(async () => {
      await updatePipelineAmount(doc.id, isNaN(val) ? null : val)
      setEditAmount(false)
      router.refresh()
    })
  }

  function saveNote() {
    setSavingNote(true)
    startTransition(async () => {
      await updatePipelineStatus(doc.id, status, note)
      setSavingNote(false)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm('¿Quitar esta propuesta del pipeline?')) return
    startTransition(async () => {
      await removeFromPipeline(doc.id)
      router.refresh()
    })
  }

  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${stale || followupOverdue ? '#fcd34d' : colors.border}`,
      borderRadius: '10px',
      padding: '12px 14px',
      opacity: isPending ? 0.6 : 1,
      transition: 'opacity 0.15s',
      cursor: 'pointer',
    }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: '700', color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>{doc.client.name}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Amount + days */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        {doc.proposalAmount
          ? <span style={{ fontSize: '13px', fontWeight: '700', color: '#111' }}>{formatCLP(doc.proposalAmount)}</span>
          : <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Sin monto</span>
        }
        {stale && (
          <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '1px 7px', borderRadius: '10px', fontWeight: '600' }}>
            {daysSince(refDate!)}d sin respuesta
          </span>
        )}
        {followupOverdue && (
          <span style={{ fontSize: '11px', background: '#fef2f2', color: '#b91c1c', padding: '1px 7px', borderRadius: '10px', fontWeight: '600' }}>
            Seguimiento vencido
          </span>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Status change */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Cambiar estado</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {PROPOSAL_STATUS_ORDER.map(s => (
                <button key={s} onClick={() => changeStatus(s)}
                  disabled={s === status || isPending}
                  style={{
                    padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600',
                    cursor: s === status ? 'default' : 'pointer', border: 'none',
                    background: s === status ? PROPOSAL_STATUS_COLORS[s].bg : '#f1f5f9',
                    color: s === status ? PROPOSAL_STATUS_COLORS[s].text : '#374151',
                    outline: s === status ? `1.5px solid ${PROPOSAL_STATUS_COLORS[s].border}` : 'none',
                  }}>
                  {PROPOSAL_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Amount edit */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Monto (CLP)</p>
            {editAmount ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input value={amountInput} onChange={e => setAmountInput(e.target.value)}
                  style={{ padding: '5px 9px', borderRadius: '7px', border: '1.5px solid #d1d5db', fontSize: '13px', width: '120px' }}
                  onKeyDown={e => { if (e.key === 'Enter') saveAmount(); if (e.key === 'Escape') setEditAmount(false) }}
                  autoFocus />
                <button onClick={saveAmount} style={{ padding: '5px 10px', background: '#111', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Guardar</button>
                <button onClick={() => setEditAmount(false)} style={{ padding: '5px 10px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setEditAmount(true)}
                style={{ fontSize: '13px', color: '#111', background: '#f1f5f9', border: 'none', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontWeight: doc.proposalAmount ? '700' : '400' }}>
                {doc.proposalAmount ? formatCLP(doc.proposalAmount) : 'Añadir monto →'}
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Notas comerciales</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Contexto, objeciones, próximos pasos…"
              style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1.5px solid #d1d5db', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            {note !== (doc.proposalNote ?? '') && (
              <button onClick={saveNote} disabled={savingNote}
                style={{ marginTop: '5px', padding: '5px 12px', background: '#111', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                {savingNote ? 'Guardando…' : 'Guardar nota'}
              </button>
            )}
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {doc.sentAt && <span style={{ fontSize: '11px', color: '#9ca3af' }}>Enviada: {new Date(doc.sentAt).toLocaleDateString('es-CL')}</span>}
            {doc.viewedAt && <span style={{ fontSize: '11px', color: '#9ca3af' }}>Vista: {new Date(doc.viewedAt).toLocaleDateString('es-CL')}</span>}
            {doc.responseAt && <span style={{ fontSize: '11px', color: '#9ca3af' }}>Respuesta: {new Date(doc.responseAt).toLocaleDateString('es-CL')}</span>}
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Actualizado: {new Date(doc.updatedAt).toLocaleDateString('es-CL')}</span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px', flexWrap: 'wrap' }}>
            <a href={`/cotizador?docId=${doc.id}`}
              style={{ fontSize: '12px', fontWeight: '600', color: '#1d4ed8', textDecoration: 'none', padding: '5px 10px', background: '#eff6ff', borderRadius: '7px' }}>
              Editar →
            </a>
            {status === 'aceptada' && (() => {
              const params = new URLSearchParams({ cliente: doc.client.id, desc: doc.title })
              if (doc.proposalAmount) params.set('netAmount', String(doc.proposalAmount))
              return (
                <a href={`/flujo/trabajos/new?${params}`}
                  style={{ fontSize: '12px', fontWeight: '600', color: '#15803d', textDecoration: 'none', padding: '5px 10px', background: '#f0fdf4', borderRadius: '7px', border: '1px solid #bbf7d0' }}>
                  Crear trabajo en Flujo →
                </a>
              )
            })()}
            <button onClick={remove}
              style={{ fontSize: '12px', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
              Quitar del pipeline
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------
function KpiTile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${warn ? '#fcd34d' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px 20px', minWidth: '140px' }}>
      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</p>
      <p style={{ fontSize: '22px', fontWeight: '800', color: warn ? '#92400e' : '#111', margin: '4px 0 0' }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------
interface Props {
  docs: PipelineDoc[]
  kpis: { total: number; enJuego: number; tasaCierre: number; porVencer: number }
}

type ColumnId = ProposalStatus | 'abierto' | 'cerrado'

const COLUMNS: { id: ProposalStatus; statuses: ProposalStatus[] }[] = [
  { id: 'borrador',  statuses: ['borrador'] },
  { id: 'enviada',   statuses: ['enviada'] },
  { id: 'vista',     statuses: ['vista'] },
  { id: 'aceptada',  statuses: ['aceptada'] },
  { id: 'rechazada', statuses: ['rechazada', 'perdida'] },
]

export function PipelineBoard({ docs, kpis }: Props) {
  const [filter, setFilter] = useState<'activo' | 'cerrado' | 'todo'>('activo')

  const visible = docs.filter(d => {
    if (filter === 'activo') return ['borrador', 'enviada', 'vista'].includes(d.proposalStatus)
    if (filter === 'cerrado') return ['aceptada', 'rechazada', 'perdida'].includes(d.proposalStatus)
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <KpiTile label="En pipeline" value={String(kpis.total)} />
        <KpiTile label="Monto en juego" value={kpis.enJuego > 0 ? formatCLP(kpis.enJuego) : '—'} sub="enviada + vista" />
        <KpiTile label="Tasa de cierre" value={`${kpis.tasaCierre}%`} sub="aceptadas / cerradas" />
        <KpiTile label="Por vencer" value={String(kpis.porVencer)} sub="+7 días sin respuesta" warn={kpis.porVencer > 0} />
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {(['activo', 'cerrado', 'todo'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
              background: filter === f ? '#fff' : 'transparent',
              color: filter === f ? '#111' : '#6b7280',
              boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
            {f === 'activo' ? 'Activos' : f === 'cerrado' ? 'Cerrados' : 'Todos'}
          </button>
        ))}
      </div>

      {/* Columns */}
      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '16px', fontWeight: '700' }}>Sin propuestas en pipeline</p>
          <p style={{ fontSize: '13px', margin: '6px 0 0' }}>Ve a <a href="/documentos" style={{ color: '#1d4ed8' }}>Carpetas</a> y agrega propuestas al pipeline.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', alignItems: 'start' }}>
          {COLUMNS.map(col => {
            const colDocs = visible.filter(d => col.statuses.includes(d.proposalStatus))
            if (colDocs.length === 0 && filter !== 'todo') return null
            const colColors = PROPOSAL_STATUS_COLORS[col.id]
            const colAmount = colDocs.reduce((s, d) => s + (d.proposalAmount ?? 0), 0)
            return (
              <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: colColors.bg, borderRadius: '8px', border: `1px solid ${colColors.border}` }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: colColors.text }}>
                    {col.id === 'rechazada' ? 'Rechazada / Perdida' : PROPOSAL_STATUS_LABELS[col.id]}
                    <span style={{ marginLeft: '6px', opacity: 0.7 }}>({colDocs.length})</span>
                  </span>
                  {colAmount > 0 && <span style={{ fontSize: '11px', fontWeight: '700', color: colColors.text }}>{formatCLP(colAmount)}</span>}
                </div>
                {/* Cards */}
                {colDocs.map(doc => <PipelineCard key={doc.id} doc={doc} />)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
