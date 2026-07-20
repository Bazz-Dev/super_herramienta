'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useActionState } from 'react'
import type { FormState } from '@/app/(app)/recursos/clientes/actions'
import { CLIENT_LABELS } from '@/lib/resources/schemas'
import { Button, Field, TextInput } from '@/components/quotes/ui'

type Rut = { rut: string; label: string }
type Values = {
  name?: string
  rut?: string | null
  label?: string | null
  contact?: string | null
  email?: string | null
  ruts?: { rut: string; label?: string | null }[]
  portalSlug?: string | null
  portalTheme?: string | null
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
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
  const [ruts, setRuts] = useState<Rut[]>(
    initial.ruts?.map((r) => ({ rut: r.rut, label: r.label ?? '' })) ?? [],
  )

  function addRut() { setRuts((prev) => [...prev, { rut: '', label: '' }]) }
  function removeRut(i: number) { setRuts((prev) => prev.filter((_, idx) => idx !== i)) }
  function updateRut(i: number, field: keyof Rut, val: string) {
    setRuts((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)))
  }

  // Portal: solo clientes grandes/recurrentes lo necesitan (G-decisión del
  // dueño) — no es un flag que todo cliente use. Si ya tiene portalSlug, se
  // deja fijo: cambiarlo rompería URLs ya instaladas como PWA.
  const initialColor = (() => {
    if (!initial.portalTheme) return ''
    try { return (JSON.parse(initial.portalTheme) as { primary?: string }).primary ?? '' } catch { return '' }
  })()
  const [hasPortal, setHasPortal] = useState(!!initial.portalSlug)
  const [portalSlug, setPortalSlug] = useState(initial.portalSlug ?? '')
  const slugLocked = !!initial.portalSlug

  function onTogglePortal(checked: boolean) {
    setHasPortal(checked)
    if (checked && !portalSlug) {
      const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]')
      if (nameInput?.value) setPortalSlug(slugify(nameInput.value))
    }
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre / razón social *" hint={err('name')}>
          <TextInput name="name" defaultValue={initial.name ?? ''} required placeholder="Alcon Laboratorios Chile" />
        </Field>
        <Field label="RUT principal">
          <TextInput name="rut" defaultValue={initial.rut ?? ''} placeholder="96.789.000-1" />
        </Field>
        <Field label="Contacto">
          <TextInput name="contact" defaultValue={initial.contact ?? ''} placeholder="Nombre del contacto" />
        </Field>
        <Field label="Email" hint={err('email')}>
          <TextInput name="email" type="email" defaultValue={initial.email ?? ''} />
        </Field>
        <Field label="Etiqueta">
          <select
            name="label"
            defaultValue={initial.label ?? ''}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">Sin etiqueta</option>
            {CLIENT_LABELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Multi-RUT section */}
      <div className="rounded-lg border border-dashed border-gray-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">RUTs adicionales</span>
          <button
            type="button"
            onClick={addRut}
            className="flex items-center gap-1 rounded-md border border-brand/50 px-2.5 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/10"
          >
            + Agregar RUT
          </button>
        </div>
        {ruts.length === 0 && (
          <p className="text-xs text-gray-400">Sin RUTs adicionales. Úsalos para filiales o razones sociales relacionadas.</p>
        )}
        <div className="flex flex-col gap-2">
          {ruts.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={r.rut}
                onChange={(e) => updateRut(i, 'rut', e.target.value)}
                placeholder="76.123.456-7"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <input
                type="text"
                value={r.label}
                onChange={(e) => updateRut(i, 'label', e.target.value)}
                placeholder="Etiqueta (ej: casa matriz)"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button
                type="button"
                onClick={() => removeRut(i)}
                className="rounded p-1 text-gray-400 transition-colors hover:text-red-500"
                aria-label="Eliminar RUT"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <input type="hidden" name="ruts" value={JSON.stringify(ruts.filter((r) => r.rut.trim()))} />
      </div>

      {/* Portal de cliente — solo para clientes grandes/recurrentes. Nota:
          se usa readOnly (no disabled) en los campos bloqueados — un input
          disabled no se envía en el submit del form nativo, así que el slug
          bloqueado igual tiene que viajar en el FormData. */}
      <div className="rounded-lg border border-dashed border-gray-200 p-4">
        {slugLocked ? (
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="hidden" name="hasPortal" value="on" />
            <span className="text-green-600">✓</span> Portal activo
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              name="hasPortal"
              checked={hasPortal}
              onChange={(e) => onTogglePortal(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-brand"
            />
            Este cliente tendrá un portal propio
          </label>
        )}
        <p className="mt-1 text-xs text-gray-400">
          Solo clientes grandes y recurrentes (Just Burger, Decathlon, Happyland, etc.) — no todos lo necesitan.
        </p>

        {hasPortal && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Slug del portal *" hint={err('portalSlug')}>
              <TextInput
                name="portalSlug"
                value={portalSlug}
                onChange={(e) => setPortalSlug(slugify(e.target.value))}
                readOnly={slugLocked}
                placeholder="justburger"
              />
              {slugLocked && (
                <p className="mt-1 text-xs text-gray-400">
                  No editable: cambiarlo rompería la URL del portal ya instalado.
                </p>
              )}
              {!slugLocked && portalSlug && (
                <p className="mt-1 text-xs text-gray-400">/portal/{portalSlug}</p>
              )}
            </Field>
            <Field label="Color principal" hint={err('portalColor')}>
              <input
                type="color"
                name="portalColor"
                defaultValue={initialColor || '#d42030'}
                className="h-10 w-full cursor-pointer rounded-md border border-gray-300"
              />
            </Field>
          </div>
        )}
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
