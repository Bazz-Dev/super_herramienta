import Link from 'next/link'
import { Suspense } from 'react'
import { requireActor } from '@/lib/tenant'
import { listJobs, listClientsForCashflow, listBranchesForClient } from '@/lib/cashflow/queries'
import { clp } from '@/lib/cashflow/format'
import { jobTotal, computeMetrics, computeClientBreakdown, computeMonthlyTrend, type JobLike } from '@/lib/cashflow/metrics'
import { JOB_TYPE_LABELS } from '@/lib/cashflow/labels'
import { JobFilters } from '@/components/cashflow/job-filters'
import { JobRow } from '@/components/cashflow/job-row'
import { RevenueByClient } from '@/components/cashflow/revenue-by-client'
import { MonthlyTrend } from '@/components/cashflow/monthly-trend'
import { REPORT_PRESETS, reportPresetCounts, matchesReportPreset, isPendingPaymentJob, isOverdueV2, type ReportPreset } from '@/lib/cashflow/job-presets'

// Destino propio de "Reportes" (antes vivía como estado escondido dentro de
// Trabajos) — mismos datos que Trabajos, presentados para exportar/analizar
// en vez de editar fila por fila. Ver docs/superpowers/specs/2026-07-24-flujo-caja-views-design.md.
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    cliente?: string
    estado?: string
    tipo?: string
    sucursal?: string
    desde?: string
    hasta?: string
    flujo?: string
    financiero?: string
    preset?: string
    sinTecnico?: string
  }>
}) {
  const actor = await requireActor()
  const { cliente, estado, tipo, sucursal, desde, hasta, flujo, financiero, preset, sinTecnico } = await searchParams

  const [clients, branches, allJobs] = await Promise.all([
    listClientsForCashflow(actor),
    cliente ? listBranchesForClient(actor, cliente) : Promise.resolve([]),
    listJobs(actor, {
      clientId: cliente,
      collectionStatus: estado,
      tipo,
      branchId: sucursal,
      processFlow: flujo,
      financialStage: financiero,
      sinTecnico: sinTecnico === '1',
      from: desde ? new Date(desde) : undefined,
      to: hasta ? new Date(hasta) : undefined,
    }),
  ])

  const presetCounts = reportPresetCounts(allJobs)
  const activePreset: ReportPreset = (preset as ReportPreset) in presetCounts ? (preset as ReportPreset) : 'all'
  const now = new Date()
  const jobs = activePreset === 'all' ? allJobs : allJobs.filter((j) => matchesReportPreset(j, activePreset, now))
  const showClientCol = !cliente && clients.length > 1

  const totalNeto = jobs.reduce((s, j) => s + (j.netAmount ?? 0), 0)
  const totalConIva = jobs.reduce((s, j) => s + jobTotal(j), 0)
  const pendiente = jobs.filter((j) => isPendingPaymentJob(j)).reduce((s, j) => s + jobTotal(j), 0)
  const vencido = jobs.filter((j) => isOverdueV2(j, now)).reduce((s, j) => s + jobTotal(j), 0)

  // Análisis (margen/aging/mix/tendencia/por cliente) — se movieron acá desde
  // /flujo, que ahora solo muestra los indicadores de decisión diaria. Se
  // calculan sobre `jobs` (respetando los filtros/preset activos), no sobre
  // el total sin filtrar.
  const m = computeMetrics(jobs as unknown as JobLike[], now)
  const clientBreakdown = computeClientBreakdown(jobs as unknown as Parameters<typeof computeClientBreakdown>[0])
  const monthlyTrend = computeMonthlyTrend(jobs)

  const exportParams = new URLSearchParams()
  if (cliente) exportParams.set('cliente', cliente)
  if (estado) exportParams.set('estado', estado)
  if (tipo) exportParams.set('tipo', tipo)
  if (sucursal) exportParams.set('sucursal', sucursal)
  if (desde) exportParams.set('desde', desde)
  if (hasta) exportParams.set('hasta', hasta)
  if (flujo) exportParams.set('flujo', flujo)
  if (financiero) exportParams.set('financiero', financiero)
  if (sinTecnico === '1') exportParams.set('sinTecnico', '1')
  if (activePreset !== 'all') exportParams.set('preset', activePreset)

  const presetHref = (key: ReportPreset) => {
    const p = new URLSearchParams(exportParams)
    p.delete('preset')
    if (key !== 'all') p.set('preset', key)
    return `/flujo/reportes?${p.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/flujo" className="text-xs text-gray-400 hover:text-gray-600">
            ← Flujo
          </Link>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="mt-0.5 text-sm text-gray-500">Filtre y descargue listados para cobranza, OC o facturación.</p>
        </div>
        <a
          href={`/api/flujo/export?${exportParams.toString()}`}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
          download
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Excel completo
        </a>
      </div>

      {/* Presets */}
      <div className="mt-5 flex flex-wrap gap-2">
        {REPORT_PRESETS.map((p) => (
          <Link
            key={p.key}
            href={presetHref(p.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-px hover:shadow-sm ${
              activePreset === p.key ? 'border-brand bg-brand/15 text-ink' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activePreset === p.key ? 'bg-brand text-ink' : 'bg-gray-100 text-gray-500'}`}>
              {presetCounts[p.key]}
            </span>
          </Link>
        ))}
      </div>

      <Suspense>
        <JobFilters clients={clients} branches={branches} basePath="/flujo/reportes" />
      </Suspense>

      {/* Mini-stats del resultado actual */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Resultados</p>
          <p className="mt-1 text-lg font-bold text-ink">{jobs.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Neto</p>
          <p className="mt-1 text-lg font-bold text-ink tabular-nums">{clp(totalNeto)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Total IVA incl.</p>
          <p className="mt-1 text-lg font-bold text-ink tabular-nums">{clp(totalConIva)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{activePreset === 'overdue' ? 'Monto vencido' : 'Pendiente de pago'}</p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${activePreset === 'overdue' ? 'text-red-600' : 'text-amber-600'}`}>
            {clp(activePreset === 'overdue' ? vencido : pendiente)}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {jobs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-ink">No hay registros con esta combinación</p>
            <p className="mt-1 text-xs text-gray-400">Pruebe otro período, cliente o tipo de reporte.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Fecha ejec.</th>
                {showClientCol && <th className="px-4 py-2.5 font-medium">Cliente</th>}
                <th className="px-4 py-2.5 font-medium">Sucursal</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium text-right">Neto</th>
                <th className="px-4 py-2.5 font-medium">Estado pago</th>
                <th className="px-2 py-2.5 font-medium" title="Expandir costos" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} showClient={showClientCol} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Análisis — margen, aging, mix y tendencia del mismo conjunto
          filtrado de arriba. Sección secundaria, no indicadores de
          operación diaria (esos viven en /flujo). */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-ink">Análisis</h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Margen total</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${m.marginTotal != null && m.marginTotal < 0 ? 'text-red-600' : 'text-ink'}`}>
              {m.marginTotal != null ? clp(m.marginTotal) : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Cobro promedio</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink">{m.avgCollectionDays != null ? `${m.avgCollectionDays} días` : '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Lag facturación</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink">{m.avgBillingLagDays != null ? `${m.avgBillingLagDays} días` : '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Ticket promedio</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink">{jobs.length > 0 ? clp(Math.round(totalNeto / jobs.length)) : '—'}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">Cuentas por cobrar (aging)</h3>
            <ul className="space-y-1.5 text-sm">
              {m.aging.map((a) => (
                <li key={a.bucket} className="flex justify-between">
                  <span className="text-gray-500">{a.bucket} días</span>
                  <span className="tabular-nums">{clp(a.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink">Mix por tipo</h3>
            <ul className="space-y-1.5 text-sm">
              {m.mix.map((x) => (
                <li key={x.type} className="flex justify-between">
                  <span className="text-gray-500">
                    {JOB_TYPE_LABELS[x.type] ?? x.type} ({x.count})
                  </span>
                  <span className="tabular-nums">{clp(x.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {!cliente && clientBreakdown.length > 1 && (
          <div className="mt-6">
            <RevenueByClient breakdown={clientBreakdown} />
          </div>
        )}

        {monthlyTrend.length > 1 && (
          <div className="mt-6">
            <MonthlyTrend buckets={monthlyTrend} />
          </div>
        )}
      </div>
    </div>
  )
}
