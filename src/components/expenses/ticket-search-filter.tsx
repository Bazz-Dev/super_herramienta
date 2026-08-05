'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Mismo patrón exacto que FacturaSearchFilter (cashflow/factura-search-filter.tsx)
// — búsqueda de ticket por código/título en Gastos, con debounce corto y
// preservando el resto de los filtros activos en la URL.
export function TicketSearchFilter({ basePath = '/gastos' }: { basePath?: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [value, setValue] = useState(sp.get('ticket') ?? '')

  function apply(next: string) {
    const params = new URLSearchParams(sp.toString())
    if (next.trim()) params.set('ticket', next.trim()); else params.delete('ticket')
    const qs = params.toString()
    router.push(qs ? `${basePath}?${qs}` : basePath)
  }

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        const v = e.target.value
        clearTimeout((window as unknown as { __ticketFilterTimer?: ReturnType<typeof setTimeout> }).__ticketFilterTimer)
        ;(window as unknown as { __ticketFilterTimer?: ReturnType<typeof setTimeout> }).__ticketFilterTimer = setTimeout(() => apply(v), 400)
      }}
      placeholder="Buscar ticket (código o título)…"
      aria-label="Buscar por ticket"
      className="min-h-9 w-56 rounded-md border border-gray-300 bg-white px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    />
  )
}
