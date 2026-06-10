'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { createClientInline } from '@/app/(app)/recursos/clientes/actions'
import type { FormState } from '@/app/(app)/cronograma/actions'
import type { AssignmentOptions } from '@/lib/resources/assignments'
import { Button, Field, Select, TextArea, TextInput } from '@/components/quotes/ui'
import { ASSIGNEE_ROLE_BADGE, ASSIGNEE_ROLE_LABELS, ASSIGNMENT_STATUS, ASSIGNMENT_STATUS_LABELS, type AssigneeRoleId } from '@/lib/resources/labels'

type AssigneeValue = { technicianId: string; role: AssigneeRoleId }

type Values = {
  title?: string
  description?: string | null
  start?: string
  end?: string
  status?: string
  permissionRequested?: boolean
  clientId?: string | null
  meetingUrl?: string | null
  assignees?: AssigneeValue[]
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

  // Team composition: technicians + helpers.
  const [assignees, setAssignees] = useState<AssigneeValue[]>(initial.assignees ?? [])
  const [pickTech, setPickTech] = useState('')
  const [pickRole, setPickRole] = useState<AssigneeRoleId>('tecnico')

  const techById = useMemo(() => new Map(options.technicians.map((t) => [t.id, t])), [options.technicians])
  const available = options.technicians.filter((t) => !assignees.some((a) => a.technicianId === t.id))

  function addAssignee() {
    if (!pickTech) return
    setAssignees((prev) => [...prev, { technicianId: pickTech, role: pickRole }])
    setPickTech('')
    setPickRole('tecnico')
  }
  function removeAssignee(id: string) {
    setAssignees((prev) => prev.filter((a) => a.technicianId !== id))
  }

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
      <input type="hidden" name="assignees" value={JSON.stringify(assignees)} />

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

      {/* Permiso de sucursal */}
      <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <input
          type="checkbox"
          name="permissionRequested"
          defaultChecked={initial.permissionRequested ?? false}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-green-600"
        />
        <span className="text-sm text-gray-700">
          <span className="font-medium">Permiso de sucursal solicitado</span>
          <span className="block text-xs text-gray-500">
            Si está marcado, el trabajo aparece en <span className="text-green-700">verde</span> en el calendario; si no, en{' '}
            <span className="text-amber-700">amarillo</span>.
          </span>
        </span>
      </label>

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

      {/* Equipo: técnicos y ayudantes */}
      <div>
        <span className="mb-1 block text-xs font-medium text-gray-600">Equipo asignado</span>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]">
            <Select value={pickTech} onChange={(e) => setPickTech(e.target.value)}>
              <option value="">Seleccionar persona…</option>
              {available.map((t) => (
                <option key={t.id} value={t.id}>{t.name}{t.specialty ? ` · ${t.specialty}` : ''}</option>
              ))}
            </Select>
          </div>
          <div className="w-32">
            <Select value={pickRole} onChange={(e) => setPickRole(e.target.value as AssigneeRoleId)}>
              <option value="tecnico">Técnico</option>
              <option value="ayudante">Ayudante</option>
            </Select>
          </div>
          <Button type="button" onClick={addAssignee} disabled={!pickTech}>Agregar</Button>
        </div>
        {assignees.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {assignees.map((a) => (
              <li key={a.technicianId} className={`flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-1 text-sm ${ASSIGNEE_ROLE_BADGE[a.role]}`}>
                <span className="font-medium">{techById.get(a.technicianId)?.name ?? 'Técnico'}</span>
                <span className="text-xs opacity-80">{ASSIGNEE_ROLE_LABELS[a.role]}</span>
                <button
                  type="button"
                  onClick={() => removeAssignee(a.technicianId)}
                  aria-label="Quitar"
                  className="cursor-pointer text-gray-400 hover:text-red-600"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {assignees.length === 0 && <p className="mt-2 text-xs text-gray-400">Aún no hay nadie asignado. Agrega técnicos y ayudantes para formar el equipo.</p>}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        <Link href="/cronograma" className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
