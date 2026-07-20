import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import {
  listClientsForCashflow,
  listJobs,
  getClientSummaries,
  getMonthlySummary,
} from '@/lib/cashflow/queries'
import {
  computeMetrics,
  computeClientBreakdown,
  computeMonthlyTrend,
  type JobLike,
} from '@/lib/cashflow/metrics'
import { clp } from '@/lib/cashflow/format'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { PeriodFilter } from '@/components/cashflow/period-filter'
import { RevenueByClient } from '@/components/cashflow/revenue-by-client'
import { MonthlyTrend } from '@/components/cashflow/monthly-trend'
import { JOB_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from '@/lib/cashflow/labels'
import { Suspense } from 'react'

type PeriodRange = {
  from: Date | undefined
  to: Date | undefined
  prevFrom: Date | undefined
  prevTo: Date | undefined
  deltaLabel: string
}

// periodo acepta 3 formas: preset relativo (mes/3m/6m/12m/total), año
// calendario explícito ("2026") o mes calendario explícito ("2026-07").
// Siempre devuelve también el rango "anterior" equivalente para poder
// mostrar el delta — no tiene sentido para 'total' (no hay "anterior" de
// "todo").
function periodRange(periodo: string | undefined): PeriodRange {
  const now = new Date()
  const p = periodo ?? '12m'
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(p)
  if (monthMatch) {
    const y = Number(monthMatch[1]), m = Number(monthMatch[2]) - 1
    return {
      from: new Date(y, m, 1),
      to: endOfDay(new Date(y, m + 1, 0)),
      prevFrom: new Date(y, m - 1, 1),
      prevTo: endOfDay(new Date(y, m, 0)),
      deltaLabel: 'vs mes anterior',
    }
  }

  const yearMatch = /^(\d{4})$/.exec(p)
  if (yearMatch) {
    const y = Number(yearMatch[1])
    return {
      from: new Date(y, 0, 1),
      to: endOfDay(new Date(y, 11, 31)),
      prevFrom: new Date(y - 1, 0, 1),
      prevTo: endOfDay(new Date(y - 1, 11, 31)),
      deltaLabel: 'vs año anterior',
    }
  }

  switch (p) {
    case 'mes': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        from, to: now,
        prevFrom: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        prevTo: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
        deltaLabel: 'vs mes anterior',
      }
    }
    case '3m': case '6m': case '12m': {
      const months = p === '3m' ? 3 : p === '6m' ? 6 : 12
      const from = new Date(now); from.setMonth(from.getMonth() - months)
      const prevFrom = new Date(now); prevFrom.setMonth(prevFrom.getMonth() - months * 2)
      return { from, to: now, prevFrom, prevTo: new Date(from), deltaLabel: 'vs período anterior' }
    }
    default: // 'total'
      return { from: undefined, to: undefined, prevFrom: undefined, prevTo: undefined, deltaLabel: '' }
  }
}

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null // sin base anterior (incl. 0→0), % no es una comparación útil
  return ((curr - prev) / prev) * 100
}

export default async function FlujoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; periodo?: string }>
}) {
  const session = await auth()
  const actor = session!.user
  const { cliente, periodo } = await searchParams
  const { from, to, prevFrom, prevTo, deltaLabel } = periodRange(periodo)

  const [clients, jobs, allJobs, monthlyJobs, expensesByCategory, expensesPending, prevJobs] = await Promise.all([
    listClientsForCashflow(actor),
    listJobs(actor, { clientId: cliente, from, to }),
    cliente ? Promise.resolve([]) : getClientSummaries(actor, from, to),
    cliente ? Promise.resolve([]) : getMonthlySummary(actor, 12, from, to),
    // Gastos aprobados agrupados por categoría
    prisma.expense.groupBy({
      by: ['category'],
      where: { ...tenantScope(actor), status: 'aprobado' },
      _sum: { amount: true },
      _count: { id: true },
    }),
    // Gastos pendientes de aprobación
    prisma.expense.aggregate({
      where: { ...tenantScope(actor), status: 'pendiente' },
      _count: { id: true },
      _sum: { amount: true },
    }),
    // Período anterior equivalente, para el delta de los KPI — no aplica a
    // "total" (no hay "anterior" de "todo").
    from ? listJobs(actor, { clientId: cliente, from: prevFrom, to: prevTo }) : Promise.resolve([]),
  ])

  const m = computeMetrics(jobs as unknown as JobLike[], new Date())
  // Double-cast: Prisma enum types aren't directly assignable to the string-literal
  // unions in JobLike, but values are runtime-compatible.
  type ClientInput = Parameters<typeof computeClientBreakdown>[0]
  type TrendInput  = Parameters<typeof computeMonthlyTrend>[0]
  const clientBreakdown = cliente ? [] : computeClientBreakdown(allJobs as unknown as ClientInput)
  const monthlyTrend    = cliente ? [] : computeMonthlyTrend(monthlyJobs as unknown as TrendInput)

  const prevM = from ? computeMetrics(prevJobs as unknown as JobLike[], prevTo ?? new Date()) : null
  const delta = (curr: number, prev: number | undefined) =>
    prevM && prev !== undefined
      ? (() => { const pct = pctDelta(curr, prev); return pct != null ? { pct, label: deltaLabel } : undefined })()
      : undefined

  const cobradoPct =
    m.facturado > 0 ? Math.round((m.cobrado / m.facturado) * 100) : null
  const avgTicket =
    jobs.length > 0
      ? Math.round((m.facturado + m.sinOcBacklog) / jobs.length)
      : null

  const totalExpensesApproved = expensesByCategory.reduce((s, e) => s + (e._sum.amount ?? 0), 0)
  const pendingExpenseCount = expensesPending._count.id
  const pendingExpenseAmount = expensesPending._sum.amount ?? 0
  const netMarginWithExpenses = m.cobrado > 0 ? m.cobrado - totalExpensesApproved : null

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
          <Suspense fallback={null}><PeriodFilter /></Suspense>
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

      {/* A. Cobranza */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Facturado" value={clp(m.facturado)} delta={delta(m.facturado, prevM?.facturado)} />
        <KpiCard label="Por cobrar" value={clp(m.porCobrar)} tone="warn" />
        <KpiCard label="Cobrado" value={clp(m.cobrado)} tone="good" delta={delta(m.cobrado, prevM?.cobrado)} />
        <KpiCard
          label="Vencido"
          value={clp(m.vencido)}
          tone="danger"
          hint={
            m.avgCollectionDays != null
              ? `Cobro prom. ${m.avgCollectionDays} días`
              : undefined
          }
        />
      </div>

      {/* B. Palancas de control */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Sin facturar (SIN OC)"
          value={clp(m.sinOcBacklog)}
          tone="danger"
          hint={`${m.sinOcCount} trabajos en riesgo`}
        />
        <KpiCard
          label="Lag facturación"
          value={
            m.avgBillingLagDays != null ? `${m.avgBillingLagDays} días` : '—'
          }
          hint="ejecución → factura"
        />
        <KpiCard
          label="% Cobrado"
          value={cobradoPct != null ? `${cobradoPct}%` : '—'}
          tone={
            cobradoPct == null ? undefined : cobradoPct >= 80 ? 'good' : 'warn'
          }
          hint="sobre lo facturado"
        />
        <KpiCard
          label="Ticket promedio"
          value={avgTicket != null ? clp(avgTicket) : '—'}
          hint={`${jobs.length} trabajos`}
        />
      </div>

      {/* C. Margen */}
      {m.marginTotal != null && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Margen total"
            value={clp(m.marginTotal)}
            delta={prevM?.marginTotal != null ? delta(m.marginTotal, prevM.marginTotal) : undefined}
          />
        </div>
      )}

      {/* D. Por cliente (solo cuando no hay filtro activo y hay >1 cliente) */}
      {!cliente && clientBreakdown.length > 1 && (
        <div className="mt-6">
          <RevenueByClient breakdown={clientBreakdown} />
        </div>
      )}

      {/* E. Aging + Mix */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Cuentas por cobrar (aging)
          </h2>
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
          <h2 className="mb-3 text-sm font-semibold text-ink">Mix por tipo</h2>
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

      {/* F. Tendencia mensual (solo sin filtro de cliente) */}
      {!cliente && monthlyTrend.length > 1 && (
        <div className="mt-6">
          <MonthlyTrend buckets={monthlyTrend} />
        </div>
      )}

      {/* G. Gastos operacionales */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Gastos operacionales</h2>
          <Link href="/gastos" className="text-xs text-brand hover:underline font-medium">
            Administrar gastos →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Gastos aprobados" value={clp(totalExpensesApproved)} />
          <KpiCard
            label="Resultado neto"
            value={netMarginWithExpenses != null ? clp(netMarginWithExpenses) : '—'}
            tone={netMarginWithExpenses != null ? (netMarginWithExpenses > 0 ? 'good' : 'danger') : undefined}
            hint="cobrado − gastos aprobados"
          />
          <KpiCard
            label="Gastos pendientes"
            value={pendingExpenseCount > 0 ? `${pendingExpenseCount} (${clp(pendingExpenseAmount)})` : '—'}
            tone={pendingExpenseCount > 0 ? 'warn' : undefined}
            hint="por aprobar"
          />
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Por categoría</p>
            <ul className="space-y-1">
              {expensesByCategory.length === 0 ? (
                <li className="text-xs text-gray-400">Sin gastos registrados</li>
              ) : expensesByCategory.map((e) => (
                <li key={e.category} className="flex justify-between text-xs">
                  <span className="text-gray-500">{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category} ({e._count.id})</span>
                  <span className="tabular-nums font-medium">{clp(e._sum.amount ?? 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* H. Quick links */}
      <div className="mt-6 flex gap-4 border-t border-gray-100 pt-4 text-sm text-gray-400">
        <Link href="/flujo/sucursales" className="hover:text-ink hover:underline">
          Administrar sucursales →
        </Link>
        <Link href="/flujo/trabajos" className="hover:text-ink hover:underline">
          Ver todos los trabajos →
        </Link>
        <Link href="/gastos" className="hover:text-ink hover:underline">
          Gastos operacionales →
        </Link>
      </div>
    </div>
  )
}
