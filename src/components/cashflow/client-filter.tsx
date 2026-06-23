'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export function ClientFilter({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter()
  const sp = useSearchParams()
  const current = sp.get('cliente') ?? ''
  return (
    <select
      aria-label="Filtrar por cliente"
      value={current}
      onChange={(e) => {
        const v = e.target.value
        router.push(v ? `/flujo?cliente=${v}` : '/flujo')
      }}
      className="cursor-pointer rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <option value="">Todos los clientes</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
