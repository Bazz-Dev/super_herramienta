'use client'

import { useActionState, useState } from 'react'

type FormState = { error?: string }

export function BranchEditForm({
  branch,
  clientId,
  action,
}: {
  branch: { id: string; name: string; active: boolean }
  clientId: string
  action: (id: string, form: FormData) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (_prev: FormState, form: FormData) => {
      try {
        await action(branch.id, form)
        setEditing(false)
        return {}
      } catch {
        return { error: 'Error al guardar.' }
      }
    },
    {},
  )

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-gray-400 transition-colors hover:text-gray-700"
      >
        Editar
      </button>
    )
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="active" value={branch.active ? 'on' : ''} />
      <input
        name="name"
        defaultValue={branch.name}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
        autoFocus
      />
      <button
        type="submit"
        disabled={pending}
        className="interactive inline-flex min-h-11 items-center gap-1.5 rounded bg-brand px-2.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
      >
        {pending ? '…' : 'Guardar'}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="interactive min-h-11 px-2 text-xs text-gray-400 hover:text-gray-700"
      >
        Cancelar
      </button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}
