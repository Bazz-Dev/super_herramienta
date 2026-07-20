'use client'

import { useActionState, useState, useTransition } from 'react'
import {
  createTechnicianAccount,
  resetTechnicianPassword,
  toggleTechnicianAccountActive,
  type AccountFormState,
} from '@/app/(app)/recursos/tecnicos/actions'
import { RevealedCredential } from '@/components/ui/revealed-credential'

interface Account {
  id: string
  email: string
  username: string | null
  active: boolean
}

export function TechnicianAccountPanel({
  technicianId,
  isSuper,
  account,
}: {
  technicianId: string
  isSuper: boolean
  account: Account | null
}) {
  const createAction = createTechnicianAccount.bind(null, technicianId)
  const [state, dispatch, creating] = useActionState<AccountFormState, FormData>(createAction, {})
  const [revealed, setRevealed] = useState<{ email: string; username: string | null; password: string } | null>(null)
  const [resetError, setResetError] = useState('')
  const [resetPending, startReset] = useTransition()
  const [togglePending, startToggle] = useTransition()

  // Ajuste de estado durante el render (no un Effect) para sincronizar el
  // resultado de la action con el banner revelado — evita el cascading
  // render que dispara un setState dentro de useEffect.
  const [seenSuccess, setSeenSuccess] = useState(state.success)
  if (state.success !== seenSuccess) {
    setSeenSuccess(state.success)
    if (state.success) setRevealed(state.success)
  }

  function reset() {
    if (!account) return
    setResetError('')
    startReset(async () => {
      const result = await resetTechnicianPassword(account.id)
      if ('error' in result) setResetError(result.error)
      else setRevealed({ email: account.email, username: account.username, password: result.password })
    })
  }

  function toggle() {
    if (!account) return
    startToggle(() => toggleTechnicianAccountActive(account.id, !account.active))
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Acceso a Mi Panel</h2>

      {revealed && <RevealedCredential {...revealed} onDismiss={() => setRevealed(null)} />}

      {!revealed && account && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-ink">{account.email}</p>
              {account.username && <p className="text-xs text-gray-500">@{account.username}</p>}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${account.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
              {account.active ? 'Activa' : 'Desactivada'}
            </span>
          </div>
          {isSuper ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={resetPending}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {resetPending ? 'Generando…' : 'Resetear contraseña'}
              </button>
              <button
                type="button"
                onClick={toggle}
                disabled={togglePending}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {togglePending ? 'Guardando…' : account.active ? 'Desactivar cuenta' : 'Activar cuenta'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Solo el admin puede resetear la contraseña o desactivar la cuenta.</p>
          )}
          {resetError && <p className="text-xs text-red-600">{resetError}</p>}
        </div>
      )}

      {!revealed && !account && (
        isSuper ? (
          <form action={dispatch} className="space-y-2">
            <p className="mb-1 text-xs text-gray-500">Este técnico todavía no tiene cuenta para entrar a Mi Panel.</p>
            <input
              name="email"
              type="email"
              placeholder="Email *"
              required
              className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            {state.fieldErrors?.email && <p className="text-xs text-red-600">{state.fieldErrors.email[0]}</p>}
            <input
              name="username"
              placeholder="Usuario (opcional)"
              className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            {state.fieldErrors?.username && <p className="text-xs text-red-600">{state.fieldErrors.username[0]}</p>}
            {state.error && !state.fieldErrors && <p className="text-xs text-red-600">{state.error}</p>}
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creando…' : 'Crear cuenta'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-400">Sin cuenta de acceso. Solo el admin puede crearla.</p>
        )
      )}
    </div>
  )
}
