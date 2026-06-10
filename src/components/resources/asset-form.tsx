'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '@/app/(app)/recursos/activos/actions'
import { Button, Field, Select, TextArea, TextInput } from '@/components/quotes/ui'
import { ASSET_STATUS, ASSET_STATUS_LABELS } from '@/lib/resources/labels'

type TechOption = { id: string; name: string; vehiclePlate?: string | null }
type Values = {
  name?: string
  code?: string | null
  category?: string | null
  status?: string
  holderId?: string | null
  notes?: string | null
}

export function AssetForm({
  action,
  technicians = [],
  initial = {},
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  technicians?: TechOption[]
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
        <Field label="Código / inventario">
          <TextInput name="code" defaultValue={initial.code ?? ''} placeholder="INV-001" />
        </Field>
        <Field label="Categoría">
          <TextInput name="category" defaultValue={initial.category ?? ''} placeholder="Instrumento, Vehículo…" />
        </Field>
        <Field label="Estado">
          <Select name="status" defaultValue={initial.status ?? 'available'}>
            {ASSET_STATUS.map((s) => (
              <option key={s} value={s}>
                {ASSET_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Asignada a (camioneta / técnico)" hint="Para inventario por camioneta">
          <Select name="holderId" defaultValue={initial.holderId ?? ''}>
            <option value="">— Sin asignar (bodega)</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.vehiclePlate ? ` · ${t.vehiclePlate}` : ''}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notas">
        <TextArea name="notes" rows={3} defaultValue={initial.notes ?? ''} />
      </Field>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        <Link href="/recursos/activos" className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
