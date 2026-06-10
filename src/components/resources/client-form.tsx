'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '@/app/(app)/recursos/clientes/actions'
import { Button, Field, TextInput } from '@/components/quotes/ui'

type Values = {
  name?: string
  rut?: string | null
  contact?: string | null
  email?: string | null
}

export function ClientForm({
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
        <Field label="Nombre / razón social *" hint={err('name')}>
          <TextInput name="name" defaultValue={initial.name ?? ''} required placeholder="Alcon Laboratorios Chile" />
        </Field>
        <Field label="RUT">
          <TextInput name="rut" defaultValue={initial.rut ?? ''} placeholder="96.789.000-1" />
        </Field>
        <Field label="Contacto">
          <TextInput name="contact" defaultValue={initial.contact ?? ''} placeholder="Nombre del contacto" />
        </Field>
        <Field label="Email" hint={err('email')}>
          <TextInput name="email" type="email" defaultValue={initial.email ?? ''} />
        </Field>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        <Link href="/recursos/clientes" className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
