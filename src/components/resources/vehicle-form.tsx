'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '@/app/(app)/recursos/vehiculos/actions'
import { Button, Field, Select, TextArea, TextInput } from '@/components/quotes/ui'
import { VEHICLE_STATUS, VEHICLE_STATUS_LABELS } from '@/lib/resources/labels'

type TechOption = { id: string; name: string; vehicle?: { id: string; plate: string } | null }
type Values = {
  plate?: string
  brand?: string | null
  model?: string | null
  year?: number | null
  status?: string
  technicianId?: string | null
  notes?: string | null
  revTecnicaExpiry?: Date | null
  soapExpiry?: Date | null
  permisoCirculacionExpiry?: Date | null
  lastServiceDate?: Date | null
  nextServiceDate?: Date | null
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

export function VehicleForm({
  action,
  technicians = [],
  vehicleId,
  initial = {},
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  technicians?: TechOption[]
  vehicleId?: string
  initial?: Values
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const err = (f: string) => state.fieldErrors?.[f]?.[0]

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {/* Datos básicos */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Datos del vehículo</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Patente *" hint={err('plate')}>
            <TextInput name="plate" defaultValue={initial.plate ?? ''} required placeholder="ABCD-12" />
          </Field>
          <Field label="Estado">
            <Select name="status" defaultValue={initial.status ?? 'active'}>
              {VEHICLE_STATUS.map((s) => (
                <option key={s} value={s}>{VEHICLE_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Marca">
            <TextInput name="brand" defaultValue={initial.brand ?? ''} placeholder="Toyota" />
          </Field>
          <Field label="Modelo">
            <TextInput name="model" defaultValue={initial.model ?? ''} placeholder="Hilux" />
          </Field>
          <Field label="Año" hint={err('year')}>
            <TextInput name="year" type="number" defaultValue={initial.year ?? ''} placeholder="2022" />
          </Field>
          <Field label="Técnico asignado" hint="Un técnico, una camioneta">
            <Select name="technicianId" defaultValue={initial.technicianId ?? ''}>
              <option value="">— Sin asignar</option>
              {technicians.map((t) => {
                const takenElsewhere = t.vehicle && t.vehicle.id !== vehicleId
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}{takenElsewhere ? ` · (ya en ${t.vehicle!.plate})` : ''}
                  </option>
                )
              })}
            </Select>
          </Field>
        </div>
      </section>

      {/* Documentos y vencimientos */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Documentos y vencimientos
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Revisión técnica — vence">
            <TextInput name="revTecnicaExpiry" type="date" defaultValue={toDateInput(initial.revTecnicaExpiry)} />
          </Field>
          <Field label="SOAP — vence">
            <TextInput name="soapExpiry" type="date" defaultValue={toDateInput(initial.soapExpiry)} />
          </Field>
          <Field label="Permiso de circulación — vence">
            <TextInput name="permisoCirculacionExpiry" type="date" defaultValue={toDateInput(initial.permisoCirculacionExpiry)} />
          </Field>
        </div>
      </section>

      {/* Mantención */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Mantención</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Último servicio">
            <TextInput name="lastServiceDate" type="date" defaultValue={toDateInput(initial.lastServiceDate)} />
          </Field>
          <Field label="Próximo servicio">
            <TextInput name="nextServiceDate" type="date" defaultValue={toDateInput(initial.nextServiceDate)} />
          </Field>
        </div>
      </section>

      <Field label="Notas">
        <TextArea name="notes" rows={3} defaultValue={initial.notes ?? ''} />
      </Field>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        <Link href="/recursos/vehiculos" className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
