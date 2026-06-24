import { clp } from '@/lib/cashflow/format'
import type { MonthlyBucket } from '@/lib/cashflow/metrics'

export function MonthlyTrend({ buckets }: { buckets: MonthlyBucket[] }) {
  if (buckets.length === 0) return null

  const maxTotal = Math.max(...buckets.map((b) => b.facturado + b.sinOc), 1)

  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h2 className="mb-4 text-sm font-semibold text-ink">Tendencia mensual (por ejecución)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="pb-2 font-medium">Mes</th>
              <th className="pb-2 text-right font-medium">Facturado</th>
              <th className="pb-2 text-right font-medium">Cobrado</th>
              <th className="pb-2 text-right font-medium">Sin OC</th>
              <th className="pb-2 text-right font-medium">Trab.</th>
              <th className="pb-2 pl-3 font-medium">Volumen</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => {
              const total = b.facturado + b.sinOc
              const barPct = Math.round((total / maxTotal) * 100)
              return (
                <tr key={b.month} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 font-medium text-ink">{b.label}</td>
                  <td className="py-2 text-right tabular-nums text-gray-700">
                    {clp(b.facturado)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-green-700">
                    {clp(b.cobrado)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-red-600">
                    {b.sinOc > 0 ? clp(b.sinOc) : '—'}
                  </td>
                  <td className="py-2 text-right tabular-nums text-gray-500">{b.jobCount}</td>
                  <td className="py-2 pl-3">
                    <div className="h-2 w-28 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-brand"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
