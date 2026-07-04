'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertPayroll, updatePayrollStatus, deletePayroll } from '@/lib/rrhh/actions'
import { PAYROLL_STATUS_BADGE, PAYROLL_STATUS_LABEL, MONTH_NAMES, formatClp } from '@/lib/rrhh/labels'
import { Spinner } from '@/components/ui/spinner'

interface PayrollItem {
  id: string
  technicianId: string
  month: number
  year: number
  baseSalary: number
  extras: number
  deductions: number
  note: string | null
  status: string
  paidAt: string | null
  technician: { id: string; name: string; baseSalary: number | null }
}

interface Props {
  payrolls: PayrollItem[]
  technicians: { id: string; name: string; baseSalary: number | null }[]
  defaultNew?: boolean
  defaultTechId?: string
}

const now = new Date()

export function PayrollView({ payrolls, technicians, defaultNew, defaultTechId }: Props) {
  const [showForm, setShowForm] = useState(defaultNew ?? false)
  const [filterTech, setFilterTech] = useState(defaultTechId ?? '')
  const [filterYear, setFilterYear] = useState(String(now.getFullYear()))
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    technicianId: defaultTechId ?? '',
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    baseSalary: '',
    extras: '0',
    deductions: '0',
    note: '',
  })

  function fillSalaryFromTech(techId: string) {
    const tech = technicians.find(t => t.id === techId)
    if (tech?.baseSalary) setForm(f => ({ ...f, technicianId: techId, baseSalary: String(tech.baseSalary) }))
    else setForm(f => ({ ...f, technicianId: techId }))
  }

  function submitForm() {
    if (!form.technicianId || !form.baseSalary) return
    startTransition(async () => {
      await upsertPayroll({
        technicianId: form.technicianId,
        month: parseInt(form.month),
        year: parseInt(form.year),
        baseSalary: parseInt(form.baseSalary),
        extras: parseInt(form.extras) || 0,
        deductions: parseInt(form.deductions) || 0,
        note: form.note || undefined,
      })
      setShowForm(false)
      router.refresh()
    })
  }

  const liquid = (p: PayrollItem) => p.baseSalary + p.extras - p.deductions

  const filtered = payrolls.filter(p => {
    if (filterTech && p.technicianId !== filterTech) return false
    if (filterYear && String(p.year) !== filterYear) return false
    return true
  })

  const totalFiltered = filtered.reduce((s, p) => s + liquid(p), 0)

  const years = [...new Set(payrolls.map(p => p.year))].sort((a, b) => b - a)
  if (!years.includes(now.getFullYear())) years.unshift(now.getFullYear())

  const inputCls = "rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={filterTech} onChange={e => setFilterTech(e.target.value)} className={inputCls}>
          <option value="">Todos los técnicos</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={inputCls}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {totalFiltered > 0 && (
          <span className="text-sm font-semibold text-gray-500">
            Total: <strong className="text-ink">{formatClp(totalFiltered)}</strong>
          </span>
        )}
        <button
          onClick={() => setShowForm(v => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink hover:bg-brand/90"
        >
          + Nueva liquidación
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-5 rounded-xl border border-brand/30 bg-brand/5 p-5">
          <h3 className="mb-4 text-sm font-semibold">Nueva liquidación</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Técnico *</label>
              <select value={form.technicianId} onChange={e => fillSalaryFromTech(e.target.value)} className={`${inputCls} w-full`}>
                <option value="">Seleccionar…</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Mes *</label>
              <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className={`${inputCls} w-full`}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{MONTH_NAMES[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Año *</label>
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sueldo base *</label>
              <input type="number" min="0" value={form.baseSalary} onChange={e => setForm(f => ({ ...f, baseSalary: e.target.value }))} placeholder="CLP" className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Extras / bonos</label>
              <input type="number" min="0" value={form.extras} onChange={e => setForm(f => ({ ...f, extras: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Descuentos</label>
              <input type="number" min="0" value={form.deductions} onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Nota</label>
              <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
          </div>
          {form.baseSalary && (
            <p className="mt-2 text-sm font-semibold text-gray-600">
              Líquido: <strong className="text-ink">{formatClp(parseInt(form.baseSalary) + (parseInt(form.extras) || 0) - (parseInt(form.deductions) || 0))}</strong>
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-50">Cancelar</button>
            <button onClick={submitForm} disabled={isPending || !form.technicianId || !form.baseSalary} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-ink hover:bg-brand/90 disabled:opacity-50">
              {isPending && <Spinner size={14} />}
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">Sin liquidaciones para los filtros seleccionados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Técnico</th>
                <th className="px-4 py-3 text-left">Período</th>
                <th className="px-4 py-3 text-right">Base</th>
                <th className="px-4 py-3 text-right">Extras</th>
                <th className="px-4 py-3 text-right">Desc.</th>
                <th className="px-4 py-3 text-right font-bold">Líquido</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{p.technician.name}</td>
                  <td className="px-4 py-3 text-gray-500">{MONTH_NAMES[p.month]} {p.year}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{formatClp(p.baseSalary)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-600">{p.extras > 0 ? `+${formatClp(p.extras)}` : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-500">{p.deductions > 0 ? `-${formatClp(p.deductions)}` : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-ink">{formatClp(liquid(p))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PAYROLL_STATUS_BADGE[p.status]}`}>
                      {PAYROLL_STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === 'borrador' && (
                        <button onClick={() => startTransition(async () => { await updatePayrollStatus(p.id, 'emitido'); router.refresh() })} disabled={isPending} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">{isPending && <Spinner size={10} />}Emitir</button>
                      )}
                      {p.status === 'emitido' && (
                        <button onClick={() => startTransition(async () => { await updatePayrollStatus(p.id, 'pagado'); router.refresh() })} disabled={isPending} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">{isPending && <Spinner size={10} />}Pagado</button>
                      )}
                      <button onClick={() => { if (confirm('¿Eliminar?')) startTransition(async () => { await deletePayroll(p.id); router.refresh() }) }} disabled={isPending} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100">{isPending && <Spinner size={10} />}✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
