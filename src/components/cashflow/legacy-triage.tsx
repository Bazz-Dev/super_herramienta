'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { clp } from '@/lib/cashflow/format'
import { linkJobToExistingTicket, markJobsLegacy } from '@/app/(app)/conciliacion/actions'
import { buttonClass } from '@/components/ui/button'
import { Modal } from '@/components/resources/modal'

interface TriageJob {
  id: string
  code: string | null
  description: string
  clientId: string
  clientName: string
  branchName: string | null
  netAmount: number | null
  executionDate: string | null
}
type TicketOption = { id: string; ticketCode: string; title: string }

const PAGE_SIZE = 30

// Espacio de trabajo separado para el backlog "modelo anterior" (informe
// #4/#9) — resolver de a muchos en vez de fila por fila desde la pestaña
// Conciliación normal. Dos salidas por trabajo: vincular al ticket real que
// ya existe (búsqueda scopeada por cliente, nunca cross-cliente — ver
// actions.ts) o marcarlo legado (selección múltiple, nunca automático).
export function LegacyTriage({ jobs, ticketsByClient }: { jobs: TriageJob[]; ticketsByClient: Record<string, TicketOption[]> }) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [error, setError] = useState('')

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE))
  const pageJobs = useMemo(() => jobs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [jobs, page])
  const pageIds = useMemo(() => new Set(pageJobs.map((j) => j.id)), [pageJobs])
  const allPageSelected = pageJobs.length > 0 && pageJobs.every((j) => selected.has(j.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) pageJobs.forEach((j) => next.delete(j.id))
      else pageJobs.forEach((j) => next.add(j.id))
      return next
    })
  }

  function bulkMarkLegacy() {
    setError('')
    startTransition(async () => {
      const res = await markJobsLegacy([...selected])
      if (res.error) { setError(res.error); return }
      setSelected(new Set())
      setConfirmBulk(false)
    })
  }

  if (jobs.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-10 text-center shadow-sm">
        <p className="text-sm font-semibold text-ink">Nada pendiente de triage</p>
        <p className="mt-1 text-xs text-gray-400">Todos los trabajos sin ticket ya fueron vinculados o marcados como legado.</p>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="text-xs text-gray-500">
          {jobs.length} trabajos sin ticket · {selected.size} seleccionados
        </p>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => setConfirmBulk(true)}
          className={buttonClass('secondary', 'md', selected.size === 0 ? 'opacity-50' : '')}
        >
          Marcar {selected.size > 0 ? selected.size : ''} como legado (sin ticket)
        </button>
      </div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2.5"><input type="checkbox" checked={allPageSelected} onChange={toggleAllOnPage} className="cursor-pointer" /></th>
              <th className="px-3 py-2.5 font-medium">Trabajo</th>
              <th className="px-3 py-2.5 font-medium">Cliente / sucursal</th>
              <th className="px-3 py-2.5 font-medium">Descripción</th>
              <th className="px-3 py-2.5 font-medium">Fecha</th>
              <th className="px-3 py-2.5 font-medium text-right">Monto</th>
              <th className="px-3 py-2.5 font-medium">Vincular a ticket existente</th>
            </tr>
          </thead>
          <tbody>
            {pageJobs.map((j) => (
              <TriageRow key={j.id} job={j} selected={selected.has(j.id)} onToggle={() => toggle(j.id)} tickets={ticketsByClient[j.clientId] ?? []} />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Página {page} de {totalPages} · {jobs.length} registros</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Anterior</button>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Siguiente</button>
          </div>
        </div>
      )}

      {confirmBulk && (
        <Modal open={confirmBulk} onClose={() => setConfirmBulk(false)} title="Marcar como legado">
          <p className="mb-4 text-sm text-gray-600">
            {selected.size} trabajo{selected.size !== 1 ? 's quedarán marcados' : ' quedará marcado'}{' '}
            como &ldquo;revisado, no corresponde ticket&rdquo; — dejan de aparecer como pendientes en Conciliación.
            No se crea ni vincula ningún ticket. Reversible (botón &ldquo;Deshacer&rdquo; en la pestaña Conciliación)
            si te equivocas.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmBulk(false)} className={buttonClass('secondary', 'md')}>Cancelar</button>
            <button type="button" onClick={bulkMarkLegacy} disabled={isPending} className={buttonClass('primary', 'md')}>
              {isPending ? 'Marcando…' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TriageRow({ job, selected, onToggle, tickets }: { job: TriageJob; selected: boolean; onToggle: () => void; tickets: TicketOption[] }) {
  const [ticketId, setTicketId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [linked, setLinked] = useState(false)

  function link() {
    if (!ticketId) return
    setError('')
    startTransition(async () => {
      const res = await linkJobToExistingTicket(job.id, ticketId)
      if (res.error) { setError(res.error); return }
      setLinked(true)
    })
  }

  if (linked) {
    return (
      <tr className="border-b border-gray-100 last:border-0 bg-green-50/50">
        <td className="px-3 py-2.5" />
        <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{job.code ?? job.id.slice(0, 8)}</td>
        <td colSpan={5} className="px-3 py-2.5 text-xs font-medium text-green-700">✓ Vinculado</td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <td className="px-3 py-2.5"><input type="checkbox" checked={selected} onChange={onToggle} className="cursor-pointer" /></td>
      <td className="px-3 py-2.5"><Link href={`/flujo/trabajos/${job.id}`} className="font-mono text-xs text-brand hover:underline">{job.code ?? job.id.slice(0, 8)}</Link></td>
      <td className="px-3 py-2.5"><div className="font-medium text-ink">{job.clientName}</div><div className="text-xs text-gray-400">{job.branchName ?? 'Sin sucursal'}</div></td>
      <td className="max-w-xs truncate px-3 py-2.5 text-gray-600">{job.description}</td>
      <td className="px-3 py-2.5 text-xs text-gray-500">{job.executionDate ? new Date(job.executionDate).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '—'}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{job.netAmount ? clp(job.netAmount) : '—'}</td>
      <td className="px-3 py-2.5">
        {tickets.length === 0 ? (
          <Link href={`/tickets/new?jobId=${job.id}`} className="text-xs font-semibold text-brand hover:underline">Crear ticket nuevo →</Link>
        ) : (
          <div className="flex items-center gap-1.5">
            <select
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">— Elegir ticket —</option>
              {tickets.map((t) => <option key={t.id} value={t.id}>{t.ticketCode} · {t.title}</option>)}
            </select>
            <button
              type="button"
              onClick={link}
              disabled={!ticketId || isPending}
              className="rounded-md bg-brand px-2 py-1 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? '…' : 'Vincular'}
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
      </td>
    </tr>
  )
}
