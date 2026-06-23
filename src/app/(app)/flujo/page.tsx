import Link from 'next/link'
import { auth } from '@/auth'
import { listClientsForCashflow, listJobs } from '@/lib/cashflow/queries'
import { computeMetrics, type JobLike } from '@/lib/cashflow/metrics'
import { clp } from '@/lib/cashflow/format'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { JOB_TYPE_LABELS } from '@/lib/cashflow/labels'

export default async function FlujoPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const session = await auth()
  const actor = session!.user
  const { cliente } = await searchParams

  const [clients, jobs] = await Promise.all([
    listClientsForCashflow(actor),
    listJobs(actor, { clientId: cliente }),
  ])
  const m = computeMetrics(jobs as unknown as JobLike[], new Date())

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Flujo de Caja</h1>
          <p className="mt-1 text-sm text-gray-500">Cobranza y rentabilidad por trabajo.</p>
        </div>
        <div className="flex items-center gap-2">
          <ClientFilter clients={clients} />
          <Link href="/flujo/trabajos" className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-600">
            Ver trabajos
          </Link>
        </div>
      </div>

      {/* A. Caja / cobranza */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Facturado" value={clp(m.facturado)} />
        <KpiCard label="Por cobrar" value={clp(m.porCobrar)} tone="warn" />
        <KpiCard label="Cobrado" value={clp(m.cobrado)} tone="good" />
        <KpiCard label="Vencido" value={clp(m.vencido)} tone="danger" hint={m.avgCollectionDays != null ? `Cobro prom. ${m.avgCollectionDays} días` : undefined} />
      </div>

      {/* B. Palancas de control */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Sin facturar (SIN OC)" value={clp(m.sinOcBacklog)} tone="danger" hint={`${m.sinOcCount} trabajos en riesgo`} />
        <KpiCard label="Lag facturación" value={m.avgBillingLagDays != null ? `${m.avgBillingLagDays} días` : '—'} hint="ejecución → factura" />
        <KpiCard label="Margen total" value={m.marginTotal != null ? clp(m.marginTotal) : '—'} hint={m.marginTotal == null ? 'Carga costos para activar' : undefined} />
        <KpiCard label="Trabajos" value={String(jobs.length)} />
      </div>

      {/* Aging + mix */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Cuentas por cobrar (aging)</h2>
          <ul className="space-y-1.5 text-sm">
            {m.aging.map((a) => (
              <li key={a.bucket} className="flex justify-between"><span className="text-gray-500">{a.bucket} días</span><span className="tabular-nums">{clp(a.amount)}</span></li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Mix por tipo</h2>
          <ul className="space-y-1.5 text-sm">
            {m.mix.map((x) => (
              <li key={x.type} className="flex justify-between"><span className="text-gray-500">{JOB_TYPE_LABELS[x.type] ?? x.type} ({x.count})</span><span className="tabular-nums">{clp(x.amount)}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
