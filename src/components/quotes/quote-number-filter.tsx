'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Mismo patrón que factura-search-filter.tsx/ticket-search-filter.tsx —
// filtro por N° de cotización pedido explícito del dueño ("sería más útil"),
// junto con el correlativo real de quote-editor.tsx/cotizador/actions.ts.
export function QuoteNumberFilter({ basePath = '/cotizador' }: { basePath?: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [value, setValue] = useState(sp.get('numero') ?? '')

  function apply(next: string) {
    const params = new URLSearchParams(sp.toString())
    if (next.trim()) params.set('numero', next.trim()); else params.delete('numero')
    params.delete('page')
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
        clearTimeout((window as unknown as { __quoteNumFilterTimer?: ReturnType<typeof setTimeout> }).__quoteNumFilterTimer)
        ;(window as unknown as { __quoteNumFilterTimer?: ReturnType<typeof setTimeout> }).__quoteNumFilterTimer = setTimeout(() => apply(v), 400)
      }}
      placeholder="Buscar N° de cotización…"
      aria-label="Buscar por número de cotización"
      className="min-h-9 w-56 rounded-md border border-gray-300 bg-white px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    />
  )
}
