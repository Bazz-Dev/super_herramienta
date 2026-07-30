'use client'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createBranch, toggleBranch, updateBranch } from '@/app/(app)/recursos/clientes/actions'

interface Branch {
  id: string
  name: string
  city: string | null
  address: string | null
  contactName: string | null
  contactPhone: string | null
  active: boolean
}

const fieldCls = 'flex-1 rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

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
            <input name="name" placeholder="Nombre sucursal *" required className={fieldCls} />
            <input name="city" placeholder="Ciudad" className={`${fieldCls} w-28 flex-none`} />
          </div>
          <input name="address" placeholder="Dirección" className={`${fieldCls} w-full`} />
          <div className="flex gap-2">
            <input name="contactName" placeholder="Responsable / contacto en terreno" className={fieldCls} />
            <input name="contactPhone" placeholder="Teléfono" className={`${fieldCls} w-32 flex-none`} />
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
          {branches.map((b) => <BranchRow key={b.id} branch={b} clientId={clientId} />)}
        </div>
      )}
    </div>
  )
}

function BranchRow({ branch: b, clientId }: { branch: Branch; clientId: string }) {
  const [editing, setEditing] = useState(false)
  const action = updateBranch.bind(null, b.id)
  const [state, dispatch, pending] = useActionState(action, {})
  const hasDetails = b.address || b.contactName || b.contactPhone

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className={`text-sm font-medium ${b.active ? 'text-ink' : 'text-gray-400 line-through'}`}>{b.name}</span>
          {b.city && <span className="ml-2 text-xs text-gray-400">{b.city}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/recursos/clientes/${clientId}/sucursales/${b.id}`}
            className="text-[11px] font-medium text-gray-500 hover:text-ink hover:underline"
          >
            Ver ficha →
          </Link>
          <button
            type="button"
            onClick={() => setEditing(v => !v)}
            className="text-[11px] font-medium text-brand-700 hover:underline"
          >
            {editing ? 'Cerrar' : hasDetails ? 'Editar detalles' : '+ Completar datos'}
          </button>
          <button
            type="button"
            onClick={() => toggleBranch(b.id, !b.active)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
          >
            {b.active ? 'Activa' : 'Inactiva'}
          </button>
        </div>
      </div>

      {!editing && hasDetails && (
        <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
          {b.address && <p>📍 {b.address}</p>}
          {(b.contactName || b.contactPhone) && (
            <p>👤 {[b.contactName, b.contactPhone].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      )}

      {editing && (
        <form action={dispatch} className="mt-2 space-y-2 border-t border-gray-200 pt-2">
          <input name="city" defaultValue={b.city ?? ''} placeholder="Ciudad" className={`${fieldCls} w-full`} />
          <input name="address" defaultValue={b.address ?? ''} placeholder="Dirección" className={`${fieldCls} w-full`} />
          <div className="flex gap-2">
            <input name="contactName" defaultValue={b.contactName ?? ''} placeholder="Responsable / contacto en terreno" className={fieldCls} />
            <input name="contactPhone" defaultValue={b.contactPhone ?? ''} placeholder="Teléfono" className={`${fieldCls} w-32 flex-none`} />
          </div>
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:underline">
              Cerrar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
