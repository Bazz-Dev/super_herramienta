'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const PERIODS = [
  { value: 'mes', label: 'Este mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '1 año' },
  { value: 'total', label: 'Todo' },
]

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function PeriodFilter({ basePath = '/flujo' }: { basePath?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get('periodo') ?? '12m'
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // periodo puede ser un preset (mes/3m/6m/12m/total) o explícito YYYY / YYYY-MM
  const specificMatch = /^(\d{4})(?:-(\d{2}))?$/.exec(active)
  const specificYear = specificMatch?.[1] ?? ''
  const specificMonth = specificMatch?.[2] ?? ''

  function select(value: string) {
    const next = new URLSearchParams(params.toString())
    next.set('periodo', value)
    router.push(`${basePath}?${next.toString()}`)
  }

  function selectYear(year: string) {
    if (!year) { select('12m'); return }
    select(specificMonth ? `${year}-${specificMonth}` : year)
  }

  function selectMonth(month: string) {
    select(month ? `${specificYear}-${month}` : specificYear)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {PERIODS.map((p) => (
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
      <div className="flex gap-1">
        <select
          aria-label="Año específico"
          value={specificYear}
          onChange={(e) => selectYear(e.target.value)}
          className="cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 outline-none focus-visible:border-brand"
        >
          <option value="">Año…</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          aria-label="Mes específico"
          value={specificMonth}
          onChange={(e) => selectMonth(e.target.value)}
          disabled={!specificYear}
          className="cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 outline-none focus-visible:border-brand disabled:opacity-40"
        >
          <option value="">Mes…</option>
          {MONTHS.map((m, i) => (
            <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
