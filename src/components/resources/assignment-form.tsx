'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import type { FormState } from '@/app/(app)/recursos/cronograma/actions'
import type { AssignmentOptions } from '@/lib/resources/assignments'
import { Button, Field, Select, TextArea, TextInput } from '@/components/quotes/ui'
import { ASSIGNMENT_STATUS, ASSIGNMENT_STATUS_LABELS } from '@/lib/resources/labels'

type Values = {
  title?: string
  description?: string | null
  start?: string // YYYY-MM-DDTHH:mm
  end?: string
  status?: string
  technicianId?: string | null
  crewId?: string | null
  assetId?: string | null
}

export function AssignmentForm({
  action,
  options,
  initial = {},
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  options: AssignmentOptions
  initial?: Values
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const err = (f: string) => state.fieldErrors?.[f]?.[0]

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <Field label="Título *" hint={err('title')}>
        <TextInput name="title" defaultValue={initial.title ?? ''} required placeholder="Ej. Mantención UMA — Alcon" />
      </Field>
      <Field label="Descripción">
        <TextArea name="description" rows={2} defaultValue={initial.description ?? ''} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Inicio *" hint={err('start')}>
          <TextInput type="datetime-local" name="start" defaultValue={initial.start ?? ''} required />
        </Field>
        <Field label="Término *" hint={err('end')}>
          <TextInput type="datetime-local" name="end" defaultValue={initial.end ?? ''} required />
        </Field>
        <Field label="Estado">
          <Select name="status" defaultValue={initial.status ?? 'scheduled'}>
            {ASSIGNMENT_STATUS.map((s) => (
              <option key={s} value={s}>
                {ASSIGNMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Técnico">
          <Select name="technicianId" defaultValue={initial.technicianId ?? ''}>
            <option value="">—</option>
            {options.technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cuadrilla">
          <Select name="crewId" defaultValue={initial.crewId ?? ''}>
            <option value="">—</option>
            {options.crews.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Activo">
          <Select name="assetId" defaultValue={initial.assetId ?? ''}>
            <option value="">—</option>
            {options.assets.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </Field>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        <Link href="/recursos/cronograma" className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
