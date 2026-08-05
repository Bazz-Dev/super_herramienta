'use client'
import { useRouter, useSearchParams } from 'next/navigation'

// Mismo patrón exacto que ClientFilter (cashflow/client-filter.tsx) — un
// select por filtro, cada uno chico y separado, es la convención ya
// establecida en el resto de la app (ver factura-search-filter.tsx) en vez
// de un componente genérico parametrizado.
export function TechnicianFilter({
  technicians,
  basePath = '/gastos',
}: {
  technicians: { id: string; name: string }[]
  basePath?: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const current = sp.get('tecnico') ?? ''
  return (
    <select
      aria-label="Filtrar por técnico"
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(sp.toString())
        const v = e.target.value
        if (v) params.set('tecnico', v); else params.delete('tecnico')
        const qs = params.toString()
        router.push(qs ? `${basePath}?${qs}` : basePath)
      }}
      className="cursor-pointer rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <option value="">Todos los técnicos</option>
      {technicians.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )
}
