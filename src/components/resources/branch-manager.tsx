'use client'
import { useActionState, useState } from 'react'
import { createBranch, toggleBranch } from '@/app/(app)/recursos/clientes/actions'

interface Branch {
  id: string
  name: string
  city: string | null
  active: boolean
}

export function BranchManager({ clientId, branches }: { clientId: string; branches: Branch[] }) {
  const [showForm, setShowForm] = useState(false)
  const action = createBranch.bind(null, clientId)
  const [state, dispatch, pending] = useActionState(action, {})

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Sucursales ({branches.length})
        </p>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="text-xs text-brand-700 font-medium hover:underline"
        >
          {showForm ? 'Cancelar' : '+ Agregar sucursal'}
        </button>
      </div>

      {showForm && (
        <form action={dispatch} className="mb-3 rounded-lg border border-brand/20 bg-brand/5 p-3 space-y-2">
          <div className="flex gap-2">
            <input
              name="name"
              placeholder="Nombre sucursal *"
              required
              className="flex-1 rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <input
              name="city"
              placeholder="Ciudad"
              className="w-28 rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Crear sucursal'}
          </button>
        </form>
      )}

      {branches.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin sucursales. Agrega la primera.</p>
      ) : (
        <div className="space-y-1">
          {branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div>
                <span className={`text-sm font-medium ${b.active ? 'text-ink' : 'text-gray-400 line-through'}`}>{b.name}</span>
                {b.city && <span className="ml-2 text-xs text-gray-400">{b.city}</span>}
              </div>
              <button
                type="button"
                onClick={() => toggleBranch(b.id, !b.active)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
              >
                {b.active ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
