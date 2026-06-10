'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { createClientInline, type FormState } from '@/app/(app)/recursos/cronograma/actions'
import type { AssignmentOptions } from '@/lib/resources/assignments'
import { Button, Field, Select, TextArea, TextInput } from '@/components/quotes/ui'
import { ASSIGNMENT_STATUS, ASSIGNMENT_STATUS_LABELS } from '@/lib/resources/labels'

type Values = {
  title?: string
  description?: string | null
  start?: string
  end?: string
  status?: string
  technicianId?: string | null
  crewId?: string | null
  assetId?: string | null
  clientId?: string | null
  meetingUrl?: string | null
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

  // Client dropdown with inline creation.
  const [clients, setClients] = useState(options.clients)
  const [clientId, setClientId] = useState(initial.clientId ?? '')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRut, setNewRut] = useState('')
  const [savingClient, setSavingClient] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  async function saveClient() {
    setSavingClient(true)
    setClientError(null)
    const res = await createClientInline(newName, newRut)
    setSavingClient(false)
    if ('error' in res) {
      setClientError(res.error)
      return
    }
    setClients((c) => [...c, res].sort((a, b) => a.name.localeCompare(b.name)))
    setClientId(res.id)
    setAdding(false)
    setNewName('')
    setNewRut('')
  }

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
              <option key={s} value={s}>{ASSIGNMENT_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Enlace de reunión (Meet/Zoom)">
          <TextInput type="url" name="meetingUrl" defaultValue={initial.meetingUrl ?? ''} placeholder="https://meet.google.com/..." />
        </Field>
      </div>

      {/* Cliente con creación inline */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Cliente</span>
          <button type="button" onClick={() => setAdding((v) => !v)} className="cursor-pointer text-xs text-brand-600 hover:underline">
            {adding ? 'Cancelar' : '+ Nuevo cliente'}
          </button>
        </div>
        <Select name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        {adding && (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex-1">
              <label className="text-[11px] text-gray-500">Nombre *</label>
              <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Razón social" />
            </div>
            <div className="w-32">
              <label className="text-[11px] text-gray-500">RUT</label>
              <TextInput value={newRut} onChange={(e) => setNewRut(e.target.value)} placeholder="76.xxx.xxx-x" />
            </div>
            <Button type="button" onClick={saveClient} disabled={savingClient || !newName.trim()}>
              {savingClient ? 'Guardando…' : 'Guardar cliente'}
            </Button>
            {clientError && <p className="w-full text-xs text-red-600">{clientError}</p>}
          </div>
        )}
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
