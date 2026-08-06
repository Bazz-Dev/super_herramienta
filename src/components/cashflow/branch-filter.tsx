'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export function BranchFilter({
  branches,
  basePath = '/cotizador',
}: {
  branches: { id: string; name: string }[]
  basePath?: string
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const current = sp.get('sucursal') ?? ''
  return (
    <select
      aria-label="Filtrar por sucursal"
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(sp.toString())
        const v = e.target.value
        if (v) params.set('sucursal', v); else params.delete('sucursal')
        params.delete('page')
        const qs = params.toString()
        router.push(qs ? `${basePath}?${qs}` : basePath)
      }}
      className="cursor-pointer rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <option value="">Todas las sucursales</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  )
}
