const TONES: Record<string, string> = {
  default: 'border-gray-200',
  warn: 'border-amber-300 bg-amber-50',
  danger: 'border-red-300 bg-red-50',
  good: 'border-green-300 bg-green-50',
}

export function KpiCard({
  label, value, hint, tone = 'default', delta,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warn' | 'danger' | 'good'
  // Comparación vs el período equivalente anterior — la "historia" del dato,
  // no solo la foto fija. pct puede ser negativo.
  delta?: { pct: number; label: string }
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm min-w-0 overflow-hidden ${TONES[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink tabular-nums sm:text-2xl">{value}</p>
      {delta && (
        <p className={`mt-0.5 text-xs font-semibold ${delta.pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {delta.pct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta.pct))}% {delta.label}
        </p>
      )}
      {hint && <p className="mt-0.5 text-xs text-gray-400 truncate">{hint}</p>}
    </div>
  )
}
