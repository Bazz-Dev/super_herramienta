'use client'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  clients: { id: string; name: string }[]
  users: { id: string; name: string }[]
}

export function TicketFilters({ clients, users }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const clientId = sp.get('clientId') ?? ''
  const assignedToId = sp.get('assignedToId') ?? ''

  function navigate(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    router.push(`/tickets?${p.toString()}`)
  }

  const hasFilters = clientId || assignedToId

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={clientId}
        onChange={(e) => navigate('clientId', e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40"
      >
        <option value="">Todos los clientes</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <select
        value={assignedToId}
        onChange={(e) => navigate('assignedToId', e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/40"
      >
        <option value="">Todos los técnicos</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>

      {hasFilters && (
        <a href="/tickets" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 transition">
          Limpiar filtros
        </a>
      )}
    </div>
  )
}
