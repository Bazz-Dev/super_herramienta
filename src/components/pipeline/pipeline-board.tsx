'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PipelineDoc } from '@/lib/pipeline/queries'
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_BADGE,
  PROPOSAL_STATUS_ORDER,
  PROPOSAL_STATUS_ACCENT,
  formatCLP,
  daysSince,
} from '@/lib/pipeline/labels'
import {
  updatePipelineStatus,
  updatePipelineAmount,
  removeFromPipeline,
} from '@/lib/pipeline/actions'
import type { ProposalStatus } from '@/generated/prisma/enums'
import { cn } from '@/lib/cn'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput, TextArea } from '@/components/quotes/ui'

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
  const badge = PROPOSAL_STATUS_BADGE[status]

  // Urgency: enviada/vista > 7 days without response
  const refDate = doc.viewedAt ?? doc.sentAt
  const stale = (status === 'enviada' || status === 'vista') && refDate && daysSince(refDate) > 7

  // Follow-up: overdue
  const followupOverdue = doc.followUpAt && new Date(doc.followUpAt) < new Date() && !['aceptada', 'rechazada', 'perdida'].includes(status)
  const needsAttention = stale || followupOverdue

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
    <Card
      onClick={() => setExpanded((e) => !e)}
      accent={needsAttention ? 'warn' : PROPOSAL_STATUS_ACCENT[status]}
      className={cn(
        'cursor-pointer p-3.5 transition-opacity',
        isPending && 'opacity-60',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{doc.title}</p>
          <p className="mt-0.5 text-[11px] text-gray-500">{doc.client.name}</p>
        </div>
        <Badge tone={badge.tone} className={badge.className}>{PROPOSAL_STATUS_LABELS[status]}</Badge>
      </div>

      {/* Amount + flags */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {doc.proposalAmount ? (
          <span className="text-[13px] font-bold text-ink">{formatCLP(doc.proposalAmount)}</span>
        ) : (
          <span className="text-xs italic text-gray-400">Sin monto</span>
        )}
        {stale && <Badge tone="warn">{daysSince(refDate!)}d sin respuesta</Badge>}
        {followupOverdue && <Badge tone="danger">Seguimiento vencido</Badge>}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div onClick={(e) => e.stopPropagation()} className="mt-3 flex cursor-default flex-col gap-3 border-t border-gray-100 pt-3">
          {/* Status change */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Cambiar estado</p>
            <div className="flex flex-wrap gap-1.5">
              {PROPOSAL_STATUS_ORDER.map((s) => {
                const sBadge = PROPOSAL_STATUS_BADGE[s]
                const active = s === status
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeStatus(s)}
                    disabled={active || isPending}
                    className={cn(
                      'interactive rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                      active ? 'cursor-default' : 'cursor-pointer hover:opacity-70 disabled:cursor-not-allowed',
                    )}
                  >
                    <Badge tone={sBadge.tone} className={cn(sBadge.className, active && 'ring-1 ring-inset ring-current')}>
                      {PROPOSAL_STATUS_LABELS[s]}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Amount edit */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Monto (CLP)</p>
            {editAmount ? (
              <div className="flex items-center gap-1.5">
                <TextInput
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveAmount(); if (e.key === 'Escape') setEditAmount(false) }}
                  className="w-32"
                  autoFocus
                />
                <Button size="sm" onClick={saveAmount}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditAmount(false)}>✕</Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEditAmount(true)}>
                {doc.proposalAmount ? formatCLP(doc.proposalAmount) : 'Añadir monto →'}
              </Button>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Notas comerciales</p>
            <TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Contexto, objeciones, próximos pasos…"
            />
            {note !== (doc.proposalNote ?? '') && (
              <Button size="sm" className="mt-1.5" onClick={saveNote} aria-busy={savingNote}>
                {savingNote ? 'Guardando…' : 'Guardar nota'}
              </Button>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-[11px] text-gray-400">
            {doc.sentAt && <span>Enviada: {new Date(doc.sentAt).toLocaleDateString('es-CL')}</span>}
            {doc.viewedAt && <span>Vista: {new Date(doc.viewedAt).toLocaleDateString('es-CL')}</span>}
            {doc.responseAt && <span>Respuesta: {new Date(doc.responseAt).toLocaleDateString('es-CL')}</span>}
            <span>Actualizado: {new Date(doc.updatedAt).toLocaleDateString('es-CL')}</span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" variant="secondary" href={`/cotizador?docId=${doc.id}`}>Editar →</Button>
            {status === 'aceptada' && (() => {
              const params = new URLSearchParams({ cliente: doc.client.id, desc: doc.title, proposalId: doc.id })
              if (doc.proposalAmount) params.set('netAmount', String(doc.proposalAmount))
              return (
                <a
                  href={`/flujo/trabajos/new?${params}`}
                  className="inline-flex min-h-9 items-center rounded-md border border-ok-100 bg-ok-50 px-2.5 py-1.5 text-xs font-semibold text-ok-700 transition-colors hover:bg-ok-100"
                >
                  {doc.jobCount > 0 ? `Crear otro trabajo (ya hay ${doc.jobCount}) →` : 'Crear trabajo en Flujo →'}
                </a>
              )
            })()}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={remove}>Quitar del pipeline</Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// KPI tile
// ---------------------------------------------------------------------------
function KpiTile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={cn('min-w-[140px] rounded-xl border bg-white p-4 shadow-sm', warn ? 'border-warn-500/60' : 'border-gray-200')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', warn ? 'text-warn-700' : 'text-ink')}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
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

const COLUMNS: { id: ProposalStatus; statuses: ProposalStatus[] }[] = [
  { id: 'borrador',  statuses: ['borrador'] },
  { id: 'enviada',   statuses: ['enviada'] },
  { id: 'vista',     statuses: ['vista'] },
  { id: 'aceptada',  statuses: ['aceptada'] },
  { id: 'rechazada', statuses: ['rechazada', 'perdida'] },
]

const FILTERS = [
  { id: 'activo' as const,  label: 'Activos' },
  { id: 'cerrado' as const, label: 'Cerrados' },
  { id: 'todo' as const,    label: 'Todos' },
]

export function PipelineBoard({ docs, kpis }: Props) {
  const [filter, setFilter] = useState<'activo' | 'cerrado' | 'todo'>('activo')

  const visible = docs.filter((d) => {
    if (filter === 'activo') return ['borrador', 'enviada', 'vista'].includes(d.proposalStatus)
    if (filter === 'cerrado') return ['aceptada', 'rechazada', 'perdida'].includes(d.proposalStatus)
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        <KpiTile label="En pipeline" value={String(kpis.total)} />
        <KpiTile label="Monto en juego" value={kpis.enJuego > 0 ? formatCLP(kpis.enJuego) : '—'} sub="enviada + vista" />
        <KpiTile label="Tasa de cierre" value={`${kpis.tasaCierre}%`} sub="aceptadas / cerradas" />
        <KpiTile label="Por vencer" value={String(kpis.porVencer)} sub="+7 días sin respuesta" warn={kpis.porVencer > 0} />
      </div>

      {/* Filter tabs — same segmented-control convention as TechnicianProfileShell's tab bar */}
      <div className="flex w-fit gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              'interactive min-h-9 rounded-lg px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              filter === f.id ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Columns */}
      {visible.length === 0 ? (
        <EmptyState
          title="Sin propuestas en pipeline"
          description="Ve a Carpetas de clientes y agrega propuestas al pipeline para hacerles seguimiento aquí."
          action={<Button href="/documentos" variant="secondary" size="sm">Ir a carpetas →</Button>}
        />
      ) : (
        <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {COLUMNS.map((col) => {
            const colDocs = visible.filter((d) => col.statuses.includes(d.proposalStatus))
            if (colDocs.length === 0 && filter !== 'todo') return null
            const badge = PROPOSAL_STATUS_BADGE[col.id]
            const colAmount = colDocs.reduce((s, d) => s + (d.proposalAmount ?? 0), 0)
            return (
              <div key={col.id} className="flex flex-col gap-2">
                {/* Column header */}
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={badge.tone} className={badge.className}>
                      {col.id === 'rechazada' ? 'Rechazada / Perdida' : PROPOSAL_STATUS_LABELS[col.id]}
                    </Badge>
                    <span className="text-[11px] font-medium text-gray-400">({colDocs.length})</span>
                  </div>
                  {colAmount > 0 && <span className="text-[11px] font-bold text-ink">{formatCLP(colAmount)}</span>}
                </div>
                {/* Cards */}
                {colDocs.map((doc) => <PipelineCard key={doc.id} doc={doc} />)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
