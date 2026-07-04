'use client'

import { useRef, useTransition } from 'react'
import { Button, Field, TextInput, Select } from '@/components/quotes/ui'
import { Spinner } from '@/components/ui/spinner'

export function BranchForm({
  action,
  clients,
  clientId,
}: {
  action: (form: FormData) => Promise<void>
  clients: { id: string; name: string }[]
  clientId: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      await action(form)
      formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      {/* Client selector */}
      <Field label="Cliente *">
        <Select name="clientId" defaultValue={clientId} required>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      {/* Name */}
      <Field label="Nombre de sucursal *">
        <TextInput
          name="name"
          required
          placeholder="Ej. Providencia, Las Condes…"
        />
      </Field>

      {/* Active */}
      <div className="flex items-center gap-2">
        <input
          id="branch-active"
          type="checkbox"
          name="active"
          defaultChecked
          className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand"
        />
        <label htmlFor="branch-active" className="cursor-pointer text-sm text-gray-700">
          Activa
        </label>
      </div>

      <div>
        <Button type="submit" disabled={pending} aria-busy={pending} className="min-h-11">
          {pending && <Spinner size={14} />}
          {pending ? 'Guardando…' : 'Guardar sucursal'}
        </Button>
      </div>
    </form>
  )
}
