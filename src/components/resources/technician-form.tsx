'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useActionState } from 'react'
import type { FormState } from '@/app/(app)/recursos/tecnicos/actions'
import { Button, Field, TextArea, TextInput } from '@/components/quotes/ui'
import { CONTRACT_TYPE, CONTRACT_TYPE_LABELS, CONTRACT_TYPE_ACTIVE, CONTRACT_TYPE_TERMINATED } from '@/lib/resources/labels'

type Values = {
  name?: string
  rut?: string | null
  specialty?: string | null
  email?: string | null
  phone?: string | null
  active?: boolean
  notes?: string | null
  contractType?: string
  contractEndDate?: Date | null
  dailyRate?: number | null
  birthDate?: Date | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
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

  const [contractType, setContractType] = useState(initial.contractType ?? 'indefinido')
  const isTerminated = CONTRACT_TYPE_TERMINATED.includes(contractType as never)

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {/* Identificación */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Datos personales
        </h3>
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
          <Field label="Fecha de nacimiento">
            <TextInput name="birthDate" type="date" defaultValue={toDateInput(initial.birthDate)} />
          </Field>
          <Field label="Email" hint={err('email')}>
            <TextInput name="email" type="email" defaultValue={initial.email ?? ''} />
          </Field>
          <Field label="Teléfono">
            <TextInput name="phone" defaultValue={initial.phone ?? ''} placeholder="+56 9 ..." />
          </Field>
          <Field label="Contacto emergencia">
            <TextInput name="emergencyContact" defaultValue={initial.emergencyContact ?? ''} placeholder="Nombre del contacto" />
          </Field>
          <Field label="Teléfono emergencia">
            <TextInput name="emergencyPhone" defaultValue={initial.emergencyPhone ?? ''} placeholder="+56 9 ..." />
          </Field>
        </div>
      </section>

      {/* Contrato */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Contrato
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Active employment */}
          <Field label="Tipo de contrato">
            <select
              name="contractType"
              value={contractType}
              onChange={e => setContractType(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
            >
              <optgroup label="Activo">
                {CONTRACT_TYPE_ACTIVE.map(t => (
                  <option key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</option>
                ))}
              </optgroup>
              <optgroup label="Desvinculado">
                {CONTRACT_TYPE_TERMINATED.map(t => (
                  <option key={t} value={t}>{CONTRACT_TYPE_LABELS[t]}</option>
                ))}
              </optgroup>
            </select>
          </Field>
          <Field label="Término contrato" hint="Solo para plazo fijo">
            <TextInput name="contractEndDate" type="date" defaultValue={toDateInput(initial.contractEndDate)} />
          </Field>
          <Field label="Tarifa diaria (CLP)" hint="Para ayudantes eventuales">
            <TextInput name="dailyRate" type="number" min={0} defaultValue={initial.dailyRate ?? ''} placeholder="0" />
          </Field>
          {/* Active toggle — auto-off when terminated */}
          <div className="self-end pb-2">
            {isTerminated ? (
              <div className="flex items-center gap-2">
                <input type="hidden" name="active" value="false" />
                <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 border border-red-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                  Inactivo — desvinculado
                </span>
              </div>
            ) : (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={initial.active ?? true}
                  className="h-4 w-4 cursor-pointer accent-brand"
                />
                <span className="text-sm text-gray-700">Activo</span>
              </label>
            )}
          </div>
        </div>
      </section>

      {/* Notas */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Notas</h3>
        <Field label="">
          <TextArea name="notes" rows={3} defaultValue={initial.notes ?? ''} placeholder="Observaciones internas…" />
        </Field>
      </section>

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
