'use client'

import { useState, useTransition } from 'react'
import { updateTechnicianHRFields } from '@/lib/rrhh/actions'
import { Spinner } from '@/components/ui/spinner'

interface Props {
  techId: string
  hireDate: string | null
  baseSalary: number | null
  address: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  phone2: string | null
  mutualidad: string | null
}

export function TechnicianHRForm(props: Props) {
  const [editing, setEditing] = useState(false)
  const [hireDate, setHireDate] = useState(props.hireDate ?? '')
  const [baseSalary, setBaseSalary] = useState(String(props.baseSalary ?? ''))
  const [address, setAddress] = useState(props.address ?? '')
  const [emergencyContact, setEmergencyContact] = useState(props.emergencyContact ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(props.emergencyPhone ?? '')
  const [phone2, setPhone2] = useState(props.phone2 ?? '')
  const [mutualidad, setMutualidad] = useState(props.mutualidad ?? '')
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      await updateTechnicianHRFields(props.techId, {
        hireDate: hireDate || null,
        baseSalary: baseSalary ? parseInt(baseSalary) : null,
        address: address || null,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
        phone2: phone2 || null,
        mutualidad: mutualidad || null,
      })
      setEditing(false)
    })
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-xs font-semibold text-gray-400 hover:bg-gray-50 transition-colors"
      >
        ✏️ Editar datos laborales
      </button>
    )
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1"

  return (
    <section className="rounded-xl border border-brand/30 bg-brand/5 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-600">Editar datos laborales</h2>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Fecha de ingreso</label>
          <input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Sueldo base (CLP)</label>
          <input type="number" min="0" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} placeholder="Ej: 800000" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Dirección</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Contacto emergencia</label>
          <input type="text" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Teléfono emergencia</label>
          <input type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Segundo teléfono</label>
          <input type="tel" value={phone2} onChange={e => setPhone2(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Mutualidad</label>
          <input type="text" value={mutualidad} onChange={e => setMutualidad(e.target.value)} placeholder="ACHS, IST, Mutual de Seguridad..." className={inputCls} />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={isPending}
            className="inline-flex flex-1 items-center justify-center gap-2 min-h-11 rounded-lg bg-brand py-1.5 text-xs font-semibold text-ink hover:bg-brand/90 disabled:opacity-60"
          >
            {isPending && <Spinner size={14} />}
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </section>
  )
}
