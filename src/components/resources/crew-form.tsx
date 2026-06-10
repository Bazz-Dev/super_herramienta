'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '@/app/(app)/recursos/cuadrillas/actions'
import { Button, Field, TextArea, TextInput } from '@/components/quotes/ui'

type TechOption = { id: string; name: string; specialty: string | null }
type Values = {
  name?: string
  description?: string | null
  active?: boolean
  technicianIds?: string[]
}

export function CrewForm({
  action,
  technicians,
  initial = {},
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  technicians: TechOption[]
  initial?: Values
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const err = (f: string) => state.fieldErrors?.[f]?.[0]
  const selected = new Set(initial.technicianIds ?? [])

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <Field label="Nombre *" hint={err('name')}>
        <TextInput name="name" defaultValue={initial.name ?? ''} required />
      </Field>
      <Field label="Descripción">
        <TextArea name="description" rows={2} defaultValue={initial.description ?? ''} />
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="active" defaultChecked={initial.active ?? true} className="h-4 w-4 cursor-pointer accent-brand" />
        <span className="text-sm text-gray-700">Activa</span>
      </label>

      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-600">Técnicos de la cuadrilla</p>
        {technicians.length === 0 ? (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-400">
            No hay técnicos activos. Crea técnicos primero.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {technicians.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="technicianIds"
                  value={t.id}
                  defaultChecked={selected.has(t.id)}
                  className="h-4 w-4 cursor-pointer accent-brand"
                />
                <span className="text-sm text-ink">
                  {t.name}
                  {t.specialty && <span className="text-gray-400"> · {t.specialty}</span>}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        <Link href="/recursos/cuadrillas" className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
