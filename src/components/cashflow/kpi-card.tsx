import Link from 'next/link'

// White card + colored left-border accent (matches flujo de caja
// produccion/*.html reference) — replaces the old filled-pastel-background
// style used inconsistently across dashboard/flujo/reportes.
const TONES: Record<string, { border: string; value: string }> = {
  default: { border: 'border-l-gray-300', value: 'text-ink' },
  info: { border: 'border-l-blue-400', value: 'text-ink' },
  warn: { border: 'border-l-amber-400', value: 'text-ink' },
  danger: { border: 'border-l-red-400', value: 'text-red-700' },
  good: { border: 'border-l-green-500', value: 'text-ink' },
}

export function KpiCard({
  label, value, hint, tone = 'default', delta, href,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'info' | 'warn' | 'danger' | 'good'
  // Comparación vs el período equivalente anterior — la "historia" del dato,
  // no solo la foto fija. pct puede ser negativo.
  delta?: { pct: number; label: string }
  /** Hace la tarjeta clickeable (p.ej. hacia la vista filtrada correspondiente). */
  href?: string
}) {
  const t = TONES[tone]
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums sm:text-2xl ${t.value}`}>{value}</p>
      {delta && (
        <p className={`mt-0.5 text-xs font-semibold ${delta.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {delta.pct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta.pct))}% {delta.label}
        </p>
      )}
      {hint && <p className="mt-0.5 text-xs text-gray-400 truncate">{hint}</p>}
    </>
  )
  const cls = `block rounded-lg border border-l-4 border-gray-200 bg-white p-4 shadow-sm min-w-0 overflow-hidden ${t.border} ${href ? 'transition-shadow hover:shadow-md' : ''}`
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
