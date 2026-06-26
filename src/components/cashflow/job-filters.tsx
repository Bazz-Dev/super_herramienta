'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { JOB_TYPE_LABELS } from '@/lib/cashflow/labels'

type Branch = { id: string; name: string }
type Client = { id: string; name: string }

export function JobFilters({
  clients,
  branches,
  basePath = '/flujo/trabajos',
}: {
  clients: Client[]
  branches: Branch[]
  basePath?: string
}) {
  const router = useRouter()
  const sp = useSearchParams()

  function set(key: string, value: string) {
    const p = new URLSearchParams(sp.toString())
    if (value) p.set(key, value)
    else p.delete(key)
    // Reset to page 1 when filter changes
    router.push(`${basePath}?${p.toString()}`)
  }

  const cliente = sp.get('cliente') ?? ''
  const estado = sp.get('estado') ?? ''
  const tipo = sp.get('tipo') ?? ''
  const sucursal = sp.get('sucursal') ?? ''
  const desde = sp.get('desde') ?? ''
  const hasta = sp.get('hasta') ?? ''

  return (
    <div className="mt-4 flex flex-wrap items-end gap-2">
      {clients.length > 1 && (
        <select
          value={cliente}
          onChange={(e) => set('cliente', e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">Todos los clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {branches.length > 0 && (
        <select
          value={sucursal}
          onChange={(e) => set('sucursal', e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      <select
        value={tipo}
        onChange={(e) => set('tipo', e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">Todos los tipos</option>
        {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>

      <select
        value={estado}
        onChange={(e) => set('estado', e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">Todos los estados</option>
        <option value="sin_oc">Sin OC</option>
        <option value="pendiente_pago">Pendiente pago</option>
        <option value="pagado">Pagado</option>
      </select>

      <div className="flex items-center gap-1">
        <input
          type="date"
          value={desde}
          onChange={(e) => set('desde', e.target.value)}
          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          title="Desde"
        />
        <span className="text-xs text-gray-400">—</span>
        <input
          type="date"
          value={hasta}
          onChange={(e) => set('hasta', e.target.value)}
          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          title="Hasta"
        />
      </div>

      {(cliente || estado || tipo || sucursal || desde || hasta) && (
        <button
          onClick={() => router.push(basePath)}
          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50"
        >
          × Limpiar
        </button>
      )}
    </div>
  )
}
