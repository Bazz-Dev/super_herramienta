const TONES: Record<string, string> = {
  default: 'border-gray-200',
  warn: 'border-amber-300 bg-amber-50',
  danger: 'border-red-300 bg-red-50',
  good: 'border-green-300 bg-green-50',
}

export function KpiCard({
  label, value, hint, tone = 'default',
}: { label: string; value: string; hint?: string; tone?: 'default' | 'warn' | 'danger' | 'good' }) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm min-w-0 overflow-hidden ${TONES[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400 truncate">{hint}</p>}
    </div>
  )
}
