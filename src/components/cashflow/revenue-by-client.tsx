import { clp } from '@/lib/cashflow/format'
import type { ClientBreakdown } from '@/lib/cashflow/metrics'

export function RevenueByClient({ breakdown }: { breakdown: ClientBreakdown[] }) {
  if (breakdown.length === 0) return null

  const maxTotal = Math.max(...breakdown.map((c) => c.facturado + c.sinOc), 1)

  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-ink">Ingresos por cliente</h2>
      <div className="space-y-5">
        {breakdown.map((c) => {
          const total = c.facturado + c.sinOc
          const barPct = Math.round((total / maxTotal) * 100)
          return (
            <div key={c.clientId}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-ink">{c.clientName}</span>
                <span className="tabular-nums text-sm font-bold text-gray-800">{clp(total)}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-gray-100">
                <div
                  className="h-2.5 rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                <span>
                  Cobrado:{' '}
                  <span className="font-medium text-green-700">{clp(c.cobrado)}</span>
                </span>
                <span>
                  Por cobrar:{' '}
                  <span className="font-medium text-amber-700">{clp(c.porCobrar)}</span>
                </span>
                <span>
                  Sin OC:{' '}
                  <span className="font-medium text-red-600">{clp(c.sinOc)}</span>
                </span>
                <span>{c.jobCount} trabajos</span>
                {c.cobradoPct != null && (
                  <span>
                    Cobro: <span className="font-medium">{c.cobradoPct}%</span>
                  </span>
                )}
                {c.avgTicket != null && (
                  <span>
                    Ticket prom.: <span className="font-medium">{clp(c.avgTicket)}</span>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
