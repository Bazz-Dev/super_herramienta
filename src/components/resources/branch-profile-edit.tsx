'use client'
import { useActionState, useState } from 'react'
import { updateBranch, toggleBranch } from '@/app/(app)/recursos/clientes/actions'

interface Branch {
  id: string
  city: string | null
  address: string | null
  contactName: string | null
  contactPhone: string | null
  active: boolean
}

const fieldCls = 'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

// Mismo patrón que BranchRow (branch-manager.tsx) — acá vive siempre visible
// en vez de detrás de "+ Completar datos", porque esta es la ficha dedicada
// a esta sucursal, no una fila entre otras 27.
export function BranchProfileEdit({ branch }: { branch: Branch }) {
  const [editing, setEditing] = useState(false)
  const action = updateBranch.bind(null, branch.id)
  const [state, dispatch, pending] = useActionState(action, {})

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Datos de la sucursal</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {editing ? 'Cerrar' : 'Editar'}
          </button>
          <button
            type="button"
            onClick={() => toggleBranch(branch.id, !branch.active)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition hover:opacity-80 ${branch.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
          >
            {branch.active ? 'Activa' : 'Inactiva'}
          </button>
        </div>
      </div>

      {editing ? (
        <form action={dispatch} className="space-y-2">
          <input name="city" defaultValue={branch.city ?? ''} placeholder="Ciudad" className={fieldCls} />
          <input name="address" defaultValue={branch.address ?? ''} placeholder="Dirección" className={fieldCls} />
          <div className="grid grid-cols-2 gap-2">
            <input name="contactName" defaultValue={branch.contactName ?? ''} placeholder="Responsable / contacto en terreno" className={fieldCls} />
            <input name="contactPhone" defaultValue={branch.contactPhone ?? ''} placeholder="Teléfono" className={fieldCls} />
          </div>
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      ) : (
        <div className="space-y-1 text-sm text-gray-600">
          <p>📍 {branch.address || <span className="text-gray-400 italic">Sin dirección</span>}</p>
          <p>🏙️ {branch.city || <span className="text-gray-400 italic">Sin ciudad</span>}</p>
          <p>👤 {[branch.contactName, branch.contactPhone].filter(Boolean).join(' · ') || <span className="text-gray-400 italic">Sin contacto</span>}</p>
        </div>
      )}
    </div>
  )
}
