'use client'
import { useRouter, useSearchParams } from 'next/navigation'

// Un solo control de período reutilizable — Desde/Hasta con calendario
// nativo, más 3 atajos que solo rellenan esos dos campos (no un mecanismo
// paralelo). Reemplaza los presets relativos (Este mes/3 meses/6 meses/1
// año) + los selects de año/mes específico que antes coexistían en /flujo y
// /dashboard sin necesidad, y unifica con el patrón que /flujo/reportes ya
// usaba.
export function DateRangeFilter({
  basePath,
  desde: desdeProp,
  hasta: hastaProp,
}: {
  basePath: string
  desde?: string
  hasta?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const desde = desdeProp ?? params.get('desde') ?? ''
  const hasta = hastaProp ?? params.get('hasta') ?? ''

  function apply(nextDesde: string, nextHasta: string) {
    const next = new URLSearchParams(params.toString())
    if (nextDesde) next.set('desde', nextDesde); else next.delete('desde')
    if (nextHasta) next.set('hasta', nextHasta); else next.delete('hasta')
    router.push(`${basePath}?${next.toString()}`)
  }

  function toISO(d: Date) {
    return d.toISOString().slice(0, 10)
  }

  function quickSet(range: 'mes' | 'año' | 'todo') {
    const now = new Date()
    if (range === 'todo') { apply('', ''); return }
    if (range === 'mes') { apply(toISO(new Date(now.getFullYear(), now.getMonth(), 1)), toISO(now)); return }
    apply(toISO(new Date(now.getFullYear(), 0, 1)), toISO(now))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={desde}
          onChange={(e) => apply(e.target.value, hasta)}
          aria-label="Desde"
          className="interactive min-h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
        <span className="text-xs text-gray-400">—</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => apply(desde, e.target.value)}
          aria-label="Hasta"
          className="interactive min-h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </div>
      <div className="flex gap-1">
        <button onClick={() => quickSet('mes')} className="interactive min-h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-500 hover:bg-gray-50">Este mes</button>
        <button onClick={() => quickSet('año')} className="interactive min-h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-500 hover:bg-gray-50">Este año</button>
        {(desde || hasta) && (
          <button onClick={() => quickSet('todo')} className="interactive min-h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-500 hover:bg-gray-50">Todo</button>
        )}
      </div>
    </div>
  )
}
