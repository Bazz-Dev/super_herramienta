'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PILLS = [
  { label: 'Este mes', value: 'mes' },
  { label: '3 meses', value: '3m' },
  { label: '6 meses', value: '6m' },
  { label: 'Este año', value: '12m' },
  { label: 'Todo', value: 'total' },
]

export function PortalPeriodFilter({ primary, active }: { primary: string; active?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const current = active ?? params.get('periodo') ?? 'total'

  function set(v: string) {
    const p = new URLSearchParams(params.toString())
    if (v === 'total') p.delete('periodo')
    else p.set('periodo', v)
    router.push(`?${p.toString()}`)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {PILLS.map(({ label, value }) => {
        const isActive = current === value || (current === 'total' && value === 'total')
        return (
          <button
            key={value}
            onClick={() => set(value)}
            style={{
              padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
              border: isActive ? 'none' : '1px solid var(--p-bd)',
              background: isActive ? primary : 'transparent',
              color: isActive ? '#111' : 'var(--p-t2)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
