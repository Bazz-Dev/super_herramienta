export type PeriodRange = {
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
// "todo"). Compartido entre /flujo y /dashboard (mismo PeriodFilter con
// distinto basePath).
export function periodRange(periodo: string | undefined): PeriodRange {
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

export function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null // sin base anterior (incl. 0→0), % no es una comparación útil
  return ((curr - prev) / prev) * 100
}
