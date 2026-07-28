import Link from 'next/link'
import { auth } from '@/auth'
import {
  listClientsForCashflow,
  listJobs,
} from '@/lib/cashflow/queries'
import {
  computeMetrics,
  type JobLike,
} from '@/lib/cashflow/metrics'
import { clp } from '@/lib/cashflow/format'
import { periodRange, pctDelta } from '@/lib/cashflow/period'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { PeriodFilter } from '@/components/cashflow/period-filter'
import { JobAccordion } from '@/components/cashflow/job-accordion'
import { MAIN_STATUS_CHIPS, mainStatusCounts, matchesMainStatus, type MainStatus } from '@/lib/cashflow/job-presets'
import { Suspense } from 'react'

// Rediseño de densidad (owner: "el objetivo no es mostrar muchos KPIs, es
// entender qué trabajos existen y en qué etapa están"). Antes esta página
// tenía ~21 indicadores numéricos compitiendo (3 filas de KPI + 5 chips +
// 3 tarjetas de recordatorio que duplicaban los chips + 4 KPIs de gastos)
// antes de siquiera llegar a la lista de trabajos, que es el contenido
// real. Ahora: 4 KPIs de decisión + los chips (que ya filtran la lista,
// no hacen falta como bloque aparte) + la lista. Márgen/aging/mix/tendencia
// mensual/desglose por cliente se movieron a /flujo/reportes (métricas de
// análisis, no de operación diaria). Gastos operacionales tiene su propia
// página (/gastos) hace tiempo — tenerlo repetido acá era la misma
// información dos veces, no información nueva.
export default async function FlujoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; periodo?: string; estado?: string }>
}) {
  const session = await auth()
  const actor = session!.user
  const { cliente, periodo, estado } = await searchParams
  const { from, to, prevFrom, prevTo, deltaLabel } = periodRange(periodo)

  const [clients, jobs, prevJobs] = await Promise.all([
    listClientsForCashflow(actor),
    listJobs(actor, { clientId: cliente, from, to }),
    // Período anterior equivalente, para el delta de los KPI — no aplica a
    // "total" (no hay "anterior" de "todo").
    from ? listJobs(actor, { clientId: cliente, from: prevFrom, to: prevTo }) : Promise.resolve([]),
  ])

  const m = computeMetrics(jobs as unknown as JobLike[], new Date())

  const prevM = from ? computeMetrics(prevJobs as unknown as JobLike[], prevTo ?? new Date()) : null
  const delta = (curr: number, prev: number | undefined) =>
    prevM && prev !== undefined
      ? (() => { const pct = pctDelta(curr, prev); return pct != null ? { pct, label: deltaLabel } : undefined })()
      : undefined

  // Status-strip del prototipo (renderDashboard final) — 5 chips
  // (Todos/Pagadas/Pendientes de pago/Ejecutadas sin OC/No aprobadas),
  // filtran la lista de trabajos de abajo. Ver src/lib/cashflow/job-presets.ts.
  // El antiguo "reminder-bar" (Vencidas/Vencen en 7 días/Sin OC) se quitó —
  // era la misma información que estos chips, presentada dos veces.
  const jobsTyped = jobs as unknown as Parameters<typeof mainStatusCounts>[0]
  const statusCounts = mainStatusCounts(jobsTyped)
  const activeStatus: MainStatus | 'overdue' = (['all', 'paid', 'pending', 'no_po', 'rejected', 'overdue'] as const).includes(estado as never)
    ? (estado as MainStatus | 'overdue')
    : 'all'
  const now = new Date()
  const visibleJobs = activeStatus === 'all' ? jobsTyped : jobsTyped.filter((j) => matchesMainStatus(j, activeStatus, now))
  const statusHref = (key: string) => {
    const p = new URLSearchParams()
    if (cliente) p.set('cliente', cliente)
    if (periodo) p.set('periodo', periodo)
    if (key !== 'all') p.set('estado', key)
    return `/flujo?${p.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Flujo de Caja</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cobranza y rentabilidad por trabajo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}><PeriodFilter active={periodo} /></Suspense>
          <ClientFilter clients={clients} />
          <Link
            href="/flujo/trabajos"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Ver trabajos
          </Link>
          <Link
            href="/flujo/trabajos/new"
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-600"
          >
            + Nuevo trabajo
          </Link>
        </div>
      </div>

      {/* 5 indicadores de decisión — todo lo demás (margen, aging, mix,
          tendencia, desglose por cliente) vive en /flujo/reportes. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Facturado" value={clp(m.facturado)} delta={delta(m.facturado, prevM?.facturado)} />
        <KpiCard label="Por cobrar" value={clp(m.porCobrar)} tone="warn" />
        <KpiCard
          label="Vencido"
          value={clp(m.vencido)}
          tone="danger"
          hint={m.avgCollectionDays != null ? `Cobro prom. ${m.avgCollectionDays} días` : undefined}
        />
        <KpiCard label="Cobrado" value={clp(m.cobrado)} tone="good" delta={delta(m.cobrado, prevM?.cobrado)} />
        <KpiCard
          label="Ejecutado sin OC"
          value={clp(m.sinOcBacklog)}
          tone={m.sinOcBacklog > 0 ? 'danger' : undefined}
          hint={`${m.sinOcCount} trabajos en riesgo`}
        />
      </div>

      {/* Trabajos, agrupados por cliente → período */}
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Trabajos</h2>
          <div className="flex items-center gap-3">
            <Link href="/flujo/reportes" className="text-xs font-semibold text-brand hover:underline">
              Reportes →
            </Link>
            <Link href="/flujo/trabajos" className="text-xs font-semibold text-brand hover:underline">
              Ver todos →
            </Link>
          </div>
        </div>

        {/* Status-strip — tarjetas verticales (label chico arriba, número
            grande abajo), igual al status-chip real del prototipo, no pills
            horizontales pequeñas. */}
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {MAIN_STATUS_CHIPS.map((c) => (
            <Link
              key={c.key}
              href={statusHref(c.key)}
              className={`flex min-h-[66px] flex-col justify-center rounded-xl border px-3 py-2.5 text-left transition-all duration-150 hover:-translate-y-px hover:shadow-sm ${
                activeStatus === c.key ? 'border-ink shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{c.label}</span>
              <strong className="mt-1 text-xl font-extrabold tabular-nums text-ink">{statusCounts[c.key]}</strong>
            </Link>
          ))}
        </div>

        <JobAccordion jobs={visibleJobs as unknown as Parameters<typeof JobAccordion>[0]['jobs']} />
      </div>

      {/* Quick links — análisis (margen/aging/mix/tendencia/por cliente),
          gastos operacionales y sucursales viven en sus propias páginas,
          no repetidos acá. */}
      <div className="mt-6 flex flex-wrap gap-4 border-t border-gray-100 pt-4 text-sm text-gray-400">
        <Link href="/flujo/reportes" className="hover:text-ink hover:underline">
          Ver análisis y reportes →
        </Link>
        <Link href="/flujo/sucursales" className="hover:text-ink hover:underline">
          Administrar sucursales →
        </Link>
        <Link href="/gastos" className="hover:text-ink hover:underline">
          Gastos operacionales →
        </Link>
      </div>
    </div>
  )
}
