'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const PERIODS = [
  { value: 'mes', label: 'Este mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '1 año' },
  { value: 'total', label: 'Todo' },
]

export function PeriodFilter() {
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get('periodo') ?? '12m'

  function select(value: string) {
    const next = new URLSearchParams(params.toString())
    next.set('periodo', value)
    router.push(`/flujo?${next.toString()}`)
  }

  return (
    <div className="flex gap-1">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => select(p.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            active === p.value
              ? 'bg-brand text-ink'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
