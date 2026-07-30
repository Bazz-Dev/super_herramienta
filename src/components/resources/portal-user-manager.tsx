'use client'
import { useActionState, useState, useTransition } from 'react'
import {
  createPortalUser,
  resetPortalUserPassword,
  togglePortalUserActive,
  updatePortalUser,
  type PortalUserFormState,
  type UpdatePortalUserFormState,
} from '@/app/(app)/recursos/clientes/actions'
import { RevealedCredential } from '@/components/ui/revealed-credential'
import { CollapsibleSection } from '@/components/ui/collapsible-section'

interface PortalUser {
  id: string
  email: string
  username: string | null
  active: boolean
  isClientAdmin: boolean
  branchId: string | null
}
interface Branch { id: string; name: string }

export function PortalUserManager({
  clientId,
  users,
  branches,
  isSuper,
}: {
  clientId: string
  users: PortalUser[]
  branches: Branch[]
  isSuper: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const createAction = createPortalUser.bind(null, clientId)
  const [state, dispatch, creating] = useActionState<PortalUserFormState, FormData>(createAction, {})
  const [revealed, setRevealed] = useState<{ email: string; username: string | null; password: string } | null>(null)

  // Ajuste de estado durante el render (no un Effect) — mismo patrón que
  // TechnicianAccountPanel para sincronizar el resultado de la action.
  const [seenSuccess, setSeenSuccess] = useState(state.success)
  if (state.success !== seenSuccess) {
    setSeenSuccess(state.success)
    if (state.success) { setRevealed(state.success); setShowForm(false) }
  }

  const [resetError, setResetError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [resetPending, startReset] = useTransition()
  const [togglePending, startToggle] = useTransition()

  function reset(u: PortalUser) {
    setResetError('')
    setPendingId(u.id)
    startReset(async () => {
      const result = await resetPortalUserPassword(u.id)
      if ('error' in result) setResetError(result.error)
      else setRevealed({ email: u.email, username: u.username, password: result.password })
    })
  }

  function toggle(u: PortalUser) {
    setPendingId(u.id)
    startToggle(() => togglePortalUserActive(u.id, !u.active))
  }

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name

  function PortalUserRow({ u }: { u: PortalUser }) {
    const [editing, setEditing] = useState(false)
    const editAction = updatePortalUser.bind(null, u.id)
    const [editState, editDispatch, editPending] = useActionState<UpdatePortalUserFormState, FormData>(editAction, {})
    const fieldCls = 'rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

    // Cerrar solo al confirmar éxito — no de inmediato al submit, mismo
    // motivo que BranchRow: cerrar antes de que la action resuelva
    // escondería un error real.
    const [seenEditSuccess, setSeenEditSuccess] = useState(editState.success)
    if (editState.success !== seenEditSuccess) {
      setSeenEditSuccess(editState.success)
      if (editState.success) setEditing(false)
    }

    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-sm font-medium ${u.active ? 'text-ink' : 'text-gray-400 line-through'}`}>{u.email}</span>
              {u.isClientAdmin && (
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Admin cliente</span>
              )}
              {u.branchId && branchName(u.branchId) && (
                <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">{branchName(u.branchId)}</span>
              )}
            </div>
            {u.username && <span className="text-xs text-gray-400">@{u.username}</span>}
          </div>
          {isSuper ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 transition hover:bg-gray-100"
              >
                {editing ? 'Cerrar' : 'Editar'}
              </button>
              <button
                type="button"
                onClick={() => reset(u)}
                disabled={resetPending && pendingId === u.id}
                className="rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
              >
                Resetear
              </button>
              <button
                type="button"
                onClick={() => toggle(u)}
                disabled={togglePending && pendingId === u.id}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
              >
                {u.active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          ) : (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
              {u.active ? 'Activo' : 'Inactivo'}
            </span>
          )}
        </div>

        {editing && (
          <form action={editDispatch} className="mt-2 space-y-2 border-t border-gray-200 pt-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input name="email" type="email" defaultValue={u.email} placeholder="Email" required className={fieldCls} />
              <input name="username" defaultValue={u.username ?? ''} placeholder="Usuario (opcional)" className={fieldCls} />
            </div>
            {editState.error && <p className="text-xs text-red-600">{editState.error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={editPending}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
              >
                {editPending ? 'Guardando…' : 'Guardar'}
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

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Usuarios del portal ({users.length})
        </p>
        {isSuper && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="text-xs text-brand-700 font-medium hover:underline"
          >
            {showForm ? 'Cancelar' : '+ Agregar usuario autorizado'}
          </button>
        )}
      </div>

      {revealed && (
        <div className="mb-3">
          <RevealedCredential {...revealed} onDismiss={() => setRevealed(null)} />
        </div>
      )}

      {showForm && (
        <form action={dispatch} className="mb-3 rounded-lg border border-brand/20 bg-brand/5 p-3 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              name="name"
              placeholder="Nombre *"
              required
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <input
              name="email"
              type="email"
              placeholder="Email *"
              required
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <input
              name="username"
              placeholder="Usuario (opcional)"
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            {branches.length > 0 && (
              <select
                name="branchId"
                defaultValue=""
                className="rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Sin sucursal (acceso a todo el cliente)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" name="isClientAdmin" className="h-3.5 w-3.5 rounded border-gray-300 accent-brand" />
            Admin del cliente (aprueba solicitudes de sucursal)
          </label>
          {state.error && <p className="text-xs text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {creating ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      )}

      {users.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin usuarios autorizados todavía.</p>
      ) : (
        <CollapsibleSection
          title="Ver usuarios"
          summary={`${users.length} · ${users.filter((u) => u.active).length} activos`}
          defaultOpen={users.length <= 6}
        >
          <div className="space-y-1">
            {users.map((u) => <PortalUserRow key={u.id} u={u} />)}
          </div>
        </CollapsibleSection>
      )}
      {resetError && <p className="mt-2 text-xs text-red-600">{resetError}</p>}
    </div>
  )
}
