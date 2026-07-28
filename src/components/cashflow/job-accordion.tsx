'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { groupByClientPeriod, recordDate, type GroupPeriod } from '@/lib/cashflow/group-by-client-period'
import { jobTotal, type JobLike } from '@/lib/cashflow/metrics'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { JOB_TYPE_LABELS } from '@/lib/cashflow/labels'
import { simpleStatus, isPaidJob } from '@/lib/cashflow/job-presets'
import { ProcessFlowChip, FinancialStageChip } from '@/components/cashflow/job-status-chips'
import { quickUpdateJob, markJobPaid, markJobPending } from '@/app/(app)/flujo/actions'
import { Modal } from '@/components/resources/modal'
import { AutoFilledBadge } from '@/components/ui/auto-filled-badge'

type Job = JobLike & {
  id: string
  description: string
  type: string
  processFlow: string
  commercialStage: string
  operationalStage: string
  financialStage: string
  nonBillable: boolean
  status: string
  code: string | null
  createdAt: Date
  quoteRef: string | null
  purchaseOrder: string | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  client: { id: string; name: string }
  branch: { name: string } | null
}

const PERIODS: { id: GroupPeriod; label: string }[] = [
  { id: 'day', label: 'Día' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
]

function matchesSearch(job: Job, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return [job.branch?.name, job.description, job.purchaseOrder, job.invoiceNumber, job.code, job.quoteRef]
    .some((v) => v?.toLowerCase().includes(s))
}

// Lista acordeón cliente → período, la vista principal de /flujo (reemplaza
// la tabla plana). Cada trabajo se expande in-line a edición rápida sin
// navegar — ver docs/superpowers/specs/2026-07-24-flujo-caja-views-design.md.
// El toggle Lista/Calendario retoma el concepto real de la referencia (ver
// flujo de caja produccion/*.html) — un calendario mensual de densidad de
// trabajos por estado, útil para detectar patrones/huecos por día que la
// lista agrupada no muestra. No se fusiona con /cronograma: ese es
// asignación de técnicos a visitas, esto es estado financiero por día.
export function JobAccordion({ jobs }: { jobs: Job[] }) {
  const [period, setPeriod] = useState<GroupPeriod>('month')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const filtered = useMemo(() => (q.trim() ? jobs.filter((j) => matchesSearch(j, q)) : jobs), [jobs, q])
  const groups = useMemo(() => groupByClientPeriod(filtered, period), [filtered, period])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
            <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar sucursal, trabajo, OC, factura, código…"
            className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
          />
        </div>
        {view === 'list' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Agrupar</span>
            <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    period === p.id ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex w-fit gap-1 rounded-lg bg-gray-100 p-1">
          <button onClick={() => setView('list')} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${view === 'list' ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>☰ Lista</button>
          <button onClick={() => setView('calendar')} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${view === 'calendar' ? 'bg-white text-ink shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>▦ Calendario</button>
        </div>
      </div>

      {view === 'calendar' ? (
        <MonthCalendar jobs={filtered} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
          <p className="text-sm font-semibold text-ink">No encontramos trabajos con estos filtros</p>
          <p className="mt-1 text-xs text-gray-400">Pruebe otro período, cliente, estado o término de búsqueda.</p>
        </div>
      ) : groups.map((g) => (
        <section key={g.clientId} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">{g.clientName}</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">Pendiente: <strong className="font-extrabold text-ink">{clp(g.pending)}</strong></span>
              {g.overdueCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">{g.overdueCount} vencido{g.overdueCount === 1 ? '' : 's'}</span>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {g.periods.map((bucket) => (
              <div key={bucket.key} className="px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {bucket.label} <span className="font-normal normal-case text-gray-300">· {bucket.jobs.length}</span>
                </p>
                <div className="flex flex-col gap-2">
                  {bucket.jobs.map((j) => <JobCard key={j.id} job={j} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const DOT_BY_STATUS: Record<string, string> = {
  paid: 'bg-green-500',
  pending: 'bg-amber-400',
  no_po: 'bg-orange-500',
  rejected: 'bg-red-500',
  other: 'bg-gray-300',
}
const STATUS_LEGEND: { key: string; label: string }[] = [
  { key: 'paid', label: 'Pagada' },
  { key: 'pending', label: 'Con OC pendiente' },
  { key: 'no_po', label: 'Ejecutada sin OC' },
  { key: 'rejected', label: 'No aprobada' },
  { key: 'other', label: 'Otro estado' },
]
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function dayKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function MonthCalendar({ jobs }: { jobs: Job[] }) {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)) })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const map = new Map<string, Job[]>()
    for (const j of jobs) {
      const k = dayKey(recordDate(j))
      map.set(k, [...(map.get(k) ?? []), j])
    }
    return map
  }, [jobs])

  const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth()
  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7 // lunes = 0
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (Date | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month, i + 1)))]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthJobCount = [...byDay.entries()].filter(([k]) => k.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).reduce((s, [, v]) => s + v.length, 0)
  const selectedJobs = selectedDay ? byDay.get(selectedDay) ?? [] : []

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {firstOfMonth.toLocaleDateString('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </h3>
            <p className="text-xs text-gray-400">{monthJobCount} trabajo{monthJobCount === 1 ? '' : 's'} visible{monthJobCount === 1 ? '' : 's'} con los filtros actuales</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCursor(new Date(Date.UTC(year, month - 1, 1)))} className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-50">‹</button>
            <button onClick={() => { const n = new Date(); setCursor(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1))) }} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">Hoy</button>
            <button onClick={() => setCursor(new Date(Date.UTC(year, month + 1, 1)))} className="rounded-md border border-gray-300 px-2.5 py-1 text-sm text-gray-600 hover:bg-gray-50">›</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2">
          {STATUS_LEGEND.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className={`h-2 w-2 rounded-full ${DOT_BY_STATUS[s.key]}`} />{s.label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 border-b border-gray-100 text-center text-[10px] font-bold uppercase tracking-wide text-gray-400">
          {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[76px] border-b border-r border-gray-100 bg-gray-50/40" />
            const k = dayKey(d)
            const dayJobs = byDay.get(k) ?? []
            const isSelected = selectedDay === k
            const isToday = k === dayKey(new Date())
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(isSelected ? null : k)}
                disabled={dayJobs.length === 0}
                className={`min-h-[76px] border-b border-r border-gray-100 p-1.5 text-left align-top transition-colors ${
                  isSelected ? 'bg-brand/10' : dayJobs.length > 0 ? 'hover:bg-gray-50' : ''
                }`}
              >
                <span className={`text-xs ${isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand font-bold text-ink' : 'text-gray-500'}`}>{d.getUTCDate()}</span>
                {dayJobs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dayJobs.slice(0, 6).map((j) => <span key={j.id} className={`h-2 w-2 rounded-full ${DOT_BY_STATUS[simpleStatus(j)]}`} title={j.description} />)}
                    {dayJobs.length > 6 && <span className="text-[9px] font-semibold text-gray-400">+{dayJobs.length - 6}</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {new Date(selectedDay + 'T00:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} · {selectedJobs.length} trabajo{selectedJobs.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-col gap-2">
            {selectedJobs.map((j) => <JobCard key={j.id} job={j} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// Color del borde izquierdo = urgencia real (mismo predicado simpleStatus
// que ya usan los chips de estado, no un criterio nuevo).
const BORDER_BY_STATUS: Record<string, string> = {
  rejected: 'border-l-red-400',
  no_po: 'border-l-orange-400',
  pending: 'border-l-amber-400',
  paid: 'border-l-gray-200',
  other: 'border-l-gray-200',
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="truncate text-xs font-medium text-ink">{value || '—'}</p>
    </div>
  )
}

function JobCard({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isPaid = isPaidJob(job)
  const borderColor = BORDER_BY_STATUS[simpleStatus(job)] ?? 'border-l-gray-200'

  function openConfirm(e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmOpen(true)
  }

  function revertToPending() {
    startTransition(() => markJobPending(job.id))
    setConfirmOpen(false)
  }

  return (
    <div className={`group rounded-lg border border-l-4 border-gray-200 ${borderColor} transition-all duration-150 hover:shadow-sm ${isPending ? 'opacity-60' : ''} ${expanded ? 'shadow-sm' : ''}`}>
      <div className="flex cursor-pointer flex-wrap items-center gap-4 px-3.5 py-3" onClick={() => setExpanded((v) => !v)}>
        <div className="w-14 shrink-0 text-center">
          <div className="text-xl font-bold leading-none text-ink">{recordDate(job).getUTCDate()}</div>
          <div className="mt-0.5 text-[10px] uppercase text-gray-400">{recordDate(job).toLocaleDateString('es-CL', { month: 'short' })}</div>
          {!job.executionDate && <div className="mt-0.5 text-[9px] text-gray-300" title="Sin fecha de ejecución registrada — se muestra la fecha estimada del código o de carga">≈</div>}
        </div>
        <div className="min-w-40 flex-1 basis-52">
          <p className="truncate text-sm font-semibold text-ink">{job.branch?.name ?? 'Sin sucursal'}</p>
          <p className="truncate text-xs text-gray-500">{job.description}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <ProcessFlowChip value={job.processFlow} />
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{JOB_TYPE_LABELS[job.type] ?? job.type}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4 sm:gap-x-5">
          <MetaField label="Presupuesto" value={job.quoteRef ?? ''} />
          <MetaField label="OC" value={job.purchaseOrder ?? ''} />
          <MetaField label="Factura" value={job.invoiceNumber ?? ''} />
          <MetaField label="Código" value={job.code ?? ''} />
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={openConfirm}
            disabled={isPending}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-transform hover:-translate-y-px ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
          >
            {isPaid ? 'PAGADA' : 'NO PAGADA'}
          </button>
          <span className="text-base font-extrabold tabular-nums text-ink">{clp(jobTotal(job))}</span>
          <span className="text-[11px] font-semibold text-brand">Editar / ver</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-3.5 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-center justify-between">
            <FinancialStageChip value={job.financialStage} />
            <Link href={`/flujo/trabajos/${job.id}`} className="text-xs font-semibold text-brand hover:underline">
              Ver detalle completo →
            </Link>
          </div>
          <QuickEditForm job={job} />
        </div>
      )}

      {/* Confirmación deliberada — nunca un toggle de un clic sobre plata real. */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={isPaid ? 'Revertir a pendiente de pago' : 'Marcar como pagada'}>
        {isPaid ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              {job.branch?.name ?? 'Sin sucursal'} · {clp(jobTotal(job))} — ¿revertir esta factura a &quot;pendiente de pago&quot;? Se borra la fecha de pago registrada.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={revertToPending} disabled={isPending} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                Revertir
              </button>
            </div>
          </div>
        ) : (
          <MarkPaidForm job={job} onDone={() => setConfirmOpen(false)} />
        )}
      </Modal>
    </div>
  )
}

function MarkPaidForm({ job, onDone }: { job: Job; onDone: () => void }) {
  const [isPending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await markJobPaid(job.id, fd)
      onDone()
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
  const labelCls = 'mb-1 block text-xs font-semibold text-gray-500'

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">{job.branch?.name ?? 'Sin sucursal'} · {clp(jobTotal(job))}</p>
      <div>
        <label className={labelCls}>Fecha de pago</label>
        <input name="paymentDate" type="date" defaultValue={today} className={inputCls} required />
      </div>
      <div>
        <label className={labelCls}>Medio de pago</label>
        <input name="paymentMethodRaw" placeholder="Transferencia, cheque…" className={inputCls} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={isPending} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
          {isPending ? 'Guardando…' : 'Confirmar pago'}
        </button>
      </div>
    </form>
  )
}

function QuickEditForm({ job }: { job: Job }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await quickUpdateJob(job.id, fd)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }

  const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
  const labelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400'

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div><label className={labelCls}>Presupuesto</label><input name="quoteRef" defaultValue={job.quoteRef ?? ''} className={inputCls} /></div>
      <div><label className={labelCls}>Código{job.code && <AutoFilledBadge reason="Generado automáticamente al crear el trabajo — se puede corregir a mano" />}</label><input name="code" defaultValue={job.code ?? ''} className={inputCls} /></div>
      <div><label className={labelCls}>OC</label><input name="purchaseOrder" defaultValue={job.purchaseOrder ?? ''} className={inputCls} /></div>
      <div><label className={labelCls}>Factura</label><input name="invoiceNumber" defaultValue={job.invoiceNumber ?? ''} className={inputCls} /></div>
      <div><label className={labelCls}>Fecha factura</label><input name="invoiceDate" type="date" defaultValue={toDateInput(job.invoiceDate)} className={inputCls} /></div>
      <div><label className={labelCls}>Plazo (días)</label><input name="creditDays" type="number" min={0} defaultValue={job.creditDays ?? ''} className={inputCls} /></div>
      <div><label className={labelCls}>Neto</label><input name="netAmount" type="number" min={0} defaultValue={job.netAmount ?? ''} className={inputCls} /></div>
      <div><label className={labelCls}>IVA</label><input name="taxAmount" type="number" min={0} defaultValue={job.taxAmount ?? ''} className={inputCls} /></div>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
        <button type="submit" disabled={isPending} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-600 disabled:opacity-60">
          {isPending ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span className="text-xs font-medium text-green-600">Guardado ✓</span>}
      </div>
    </form>
  )
}
