'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '@/app/(app)/recursos/tecnicos/actions'
import { Button, Field, TextArea, TextInput } from '@/components/quotes/ui'

type Values = {
  name?: string
  rut?: string | null
  specialty?: string | null
  email?: string | null
  phone?: string | null
  vehiclePlate?: string | null
  active?: boolean
  notes?: string | null
}

export function TechnicianForm({
  action,
  initial = {},
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  initial?: Values
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})

  const err = (f: string) => state.fieldErrors?.[f]?.[0]

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre *" hint={err('name')}>
          <TextInput name="name" defaultValue={initial.name ?? ''} required />
        </Field>
        <Field label="Especialidad / oficio">
          <TextInput name="specialty" defaultValue={initial.specialty ?? ''} placeholder="Ej. Climatización" />
        </Field>
        <Field label="RUT">
          <TextInput name="rut" defaultValue={initial.rut ?? ''} placeholder="12.345.678-9" />
        </Field>
        <Field label="Email" hint={err('email')}>
          <TextInput name="email" type="email" defaultValue={initial.email ?? ''} />
        </Field>
        <Field label="Teléfono">
          <TextInput name="phone" defaultValue={initial.phone ?? ''} placeholder="+56 9 ..." />
        </Field>
        <Field label="Patente vehículo / camioneta">
          <TextInput name="vehiclePlate" defaultValue={initial.vehiclePlate ?? ''} placeholder="ABCD-12" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2">
          <input type="checkbox" name="active" defaultChecked={initial.active ?? true} className="h-4 w-4 cursor-pointer accent-brand" />
          <span className="text-sm text-gray-700">Activo</span>
        </label>
      </div>
      <Field label="Notas">
        <TextArea name="notes" rows={3} defaultValue={initial.notes ?? ''} />
      </Field>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        <Link href="/recursos/tecnicos" className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
