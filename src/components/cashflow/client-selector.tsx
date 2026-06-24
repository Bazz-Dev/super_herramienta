'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function ClientSelector({
  clients,
  currentId,
}: {
  clients: { id: string; name: string }[]
  currentId: string
}) {
  const router = useRouter()
  const sp = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString())
    params.set('cliente', e.target.value)
    router.push(`/flujo/trabajos/new?${params.toString()}`)
  }

  return (
    <select
      value={currentId}
      onChange={handleChange}
      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
    >
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}
