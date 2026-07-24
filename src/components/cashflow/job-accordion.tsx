'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { groupByClientPeriod, type GroupPeriod } from '@/lib/cashflow/group-by-client-period'
import { jobTotal, type JobLike } from '@/lib/cashflow/metrics'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { JOB_TYPE_LABELS } from '@/lib/cashflow/labels'
import { ProcessFlowChip, FinancialStageChip } from '@/components/cashflow/job-status-chips'
import { quickUpdateJob, toggleJobPaid } from '@/app/(app)/flujo/actions'

type Job = JobLike & {
  id: string
  description: string
  type: string
  processFlow: string
  financialStage: string
  code: string | null
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

// Lista acordeón cliente → período, la vista principal de /flujo (reemplaza
// la tabla plana). Cada trabajo se expande in-line a edición rápida sin
// navegar — ver docs/superpowers/specs/2026-07-24-flujo-caja-views-design.md.
export function JobAccordion({ jobs }: { jobs: Job[] }) {
  const [period, setPeriod] = useState<GroupPeriod>('month')
  const groups = useMemo(() => groupByClientPeriod(jobs, period), [jobs, period])

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
        Sin trabajos con este filtro.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
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

      {groups.map((g) => (
        <section key={g.clientId} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">{g.clientName}</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">Pendiente: <strong className="font-semibold text-ink">{clp(g.pending)}</strong></span>
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

function JobCard({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()

  function togglePaid(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(() => toggleJobPaid(job.id))
  }

  return (
    <div className={`rounded-lg border border-gray-200 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      <div className="flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2.5" onClick={() => setExpanded((v) => !v)}>
        <div className="w-16 shrink-0 text-center">
          <div className="text-sm font-bold leading-none text-ink">{job.executionDate ? new Date(job.executionDate).getUTCDate() : '—'}</div>
          <div className="text-[10px] uppercase text-gray-400">{job.executionDate ? new Date(job.executionDate).toLocaleDateString('es-CL', { month: 'short' }) : ''}</div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{job.branch?.name ?? 'Sin sucursal'}</p>
          <p className="truncate text-xs text-gray-500">{job.description}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <ProcessFlowChip value={job.processFlow} />
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{JOB_TYPE_LABELS[job.type] ?? job.type}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={togglePaid}
            disabled={isPending}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
              job.financialStage === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {job.financialStage === 'paid' ? 'PAGADA' : 'NO PAGADA'}
          </button>
          <span className="text-sm font-bold tabular-nums text-ink">{clp(jobTotal(job))}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-center justify-between">
            <FinancialStageChip value={job.financialStage} />
            <Link href={`/flujo/trabajos/${job.id}`} className="text-xs font-semibold text-brand hover:underline">
              Ver detalle completo →
            </Link>
          </div>
          <QuickEditForm job={job} />
        </div>
      )}
    </div>
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
      <div><label className={labelCls}>Código</label><input name="code" defaultValue={job.code ?? ''} className={inputCls} /></div>
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
