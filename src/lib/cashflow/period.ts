export type PeriodRange = {
  from: Date | undefined
  to: Date | undefined
  prevFrom: Date | undefined
  prevTo: Date | undefined
  deltaLabel: string
}

const DAY = 24 * 60 * 60 * 1000

// Un solo mecanismo de período en toda la app: Desde/Hasta explícitos (o
// ninguno de los dos = "todo"). Reemplaza los presets relativos (mes/3m/
// 6m/12m) + selects de año/mes específico que coexistían sin necesidad —
// dos formas de llegar al mismo resultado, inconsistentes entre sí. El
// "período anterior" para el delta es simplemente una ventana de igual
// duración inmediatamente antes de "desde" — funciona para cualquier rango,
// no solo para los presets que existían antes.
export function dateRange(desde?: string, hasta?: string): PeriodRange {
  if (!desde && !hasta) {
    return { from: undefined, to: undefined, prevFrom: undefined, prevTo: undefined, deltaLabel: '' }
  }
  const from = desde ? new Date(desde) : undefined
  const to = hasta ? new Date(new Date(hasta).getTime() + DAY - 1) : new Date()
  if (!from) return { from: undefined, to, prevFrom: undefined, prevTo: undefined, deltaLabel: '' }

  const spanMs = Math.max(to.getTime() - from.getTime(), DAY)
  const prevTo = new Date(from.getTime() - 1)
  const prevFrom = new Date(prevTo.getTime() - spanMs)
  return { from, to, prevFrom, prevTo, deltaLabel: 'vs período anterior' }
}

export function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null // sin base anterior (incl. 0→0), % no es una comparación útil
  return ((curr - prev) / prev) * 100
}
