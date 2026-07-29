'use client'

import { useState, useTransition } from 'react'
import { createBranch } from '@/app/(app)/recursos/clientes/actions'
import { Modal } from '@/components/resources/modal'

interface Branch { id: string; name: string }

const SELECT_CLS = 'w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40'
const CREATE_VALUE = '__create__'

// Selector de sucursal reutilizado en cualquier lugar donde se elige una
// sucursal para un ticket/trabajo nuevo (creación de ticket, creación de
// trabajo en Flujo) — agrega "+ Crear nueva sucursal" al final de las
// opciones existentes en vez de obligar a salir al formulario del cliente.
// Reutiliza createBranch() (mismo servicio que BranchManager en
// /recursos/clientes/[id]) — no hay un segundo mecanismo de creación.
export function BranchSelect({
  clientId, branches, value, onChange, disabled, placeholder = 'Sin sucursal específica', className,
  formName, required,
}: {
  clientId: string
  branches: Branch[]
  value: string
  onChange: (branchId: string, branch?: Branch) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Si se usa dentro de un <form action=...> no controlado (Server Action + FormData) — agrega el hidden input que realmente se envía, mismo patrón que SearchableCombobox. */
  formName?: string
  required?: boolean
}) {
  const [extra, setExtra] = useState<Branch[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const allBranches = [...branches, ...extra.filter((e) => !branches.some((b) => b.id === e.id))]

  function handleCreate() {
    if (!name.trim()) { setError('El nombre es obligatorio.'); return }
    setError('')
    startTransition(async () => {
      const fd = new FormData()
      fd.set('name', name.trim())
      if (city.trim()) fd.set('city', city.trim())
      const result = await createBranch(clientId, {}, fd)
      if (result.error) { setError(result.error); return }
      if (result.branch) {
        setExtra((prev) => [...prev, result.branch!])
        onChange(result.branch.id, result.branch)
        setModalOpen(false)
        setName('')
        setCity('')
      }
    })
  }

  return (
    <>
      {formName && <input type="hidden" name={formName} value={value} required={required} />}
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === CREATE_VALUE) { setError(''); setModalOpen(true); return }
          onChange(e.target.value)
        }}
        disabled={disabled}
        className={className ?? SELECT_CLS}
      >
        <option value="">{placeholder}</option>
        {allBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        <option value={CREATE_VALUE}>+ Crear nueva sucursal…</option>
      </select>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva sucursal">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
              autoFocus
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Ciudad</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Creando…' : 'Crear sucursal'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
