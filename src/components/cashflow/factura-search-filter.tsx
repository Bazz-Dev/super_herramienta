'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// Búsqueda por N° de factura en Conciliación (pedido explícito del dueño) —
// mismo criterio que ClientFilter: preserva el resto de los filtros activos
// en la URL, solo cambia "factura". Client-side porque filtrar por texto no
// necesita ida y vuelta al servidor en cada tecla — debounce simple.
export function FacturaSearchFilter({ basePath = '/conciliacion' }: { basePath?: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [value, setValue] = useState(sp.get('factura') ?? '')

  function apply(next: string) {
    const params = new URLSearchParams(sp.toString())
    if (next.trim()) params.set('factura', next.trim()); else params.delete('factura')
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
        // Debounce corto — evita una navegación por cada tecla.
        clearTimeout((window as unknown as { __facturaFilterTimer?: ReturnType<typeof setTimeout> }).__facturaFilterTimer)
        ;(window as unknown as { __facturaFilterTimer?: ReturnType<typeof setTimeout> }).__facturaFilterTimer = setTimeout(() => apply(v), 400)
      }}
      placeholder="Buscar N° de factura…"
      aria-label="Buscar por número de factura"
      className="min-h-9 w-48 rounded-md border border-gray-300 bg-white px-2.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    />
  )
}
