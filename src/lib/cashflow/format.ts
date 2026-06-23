const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
export function clp(n: number | null | undefined): string {
  return CLP.format(n ?? 0)
}
export function pct(x: number | null | undefined): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`
}
