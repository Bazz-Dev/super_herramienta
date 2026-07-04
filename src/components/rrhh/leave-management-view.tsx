'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createLeaveRequest, updateLeaveStatus, deleteLeaveRequest } from '@/lib/rrhh/actions'
import { LEAVE_TYPE_LABEL, LEAVE_STATUS_BADGE, LEAVE_STATUS_LABEL } from '@/lib/rrhh/labels'
import { Spinner } from '@/components/ui/spinner'

interface LeaveItem {
  id: string
  technicianId: string
  type: string
  startDate: string
  endDate: string
  days: number
  status: string
  note: string | null
  technician: { id: string; name: string }
  approvedBy: { name: string } | null
}

interface Props {
  leaves: LeaveItem[]
  technicians: { id: string; name: string }[]
  defaultNew?: boolean
  defaultTechId?: string
}

const LEAVE_TYPES = ['vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'licencia_medica', 'otro']

export function LeaveManagementView({ leaves, technicians, defaultNew, defaultTechId }: Props) {
  const [showForm, setShowForm] = useState(defaultNew ?? false)
  const [filter, setFilter] = useState<string>('all')
  const [techFilter, setTechFilter] = useState(defaultTechId ?? '')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [form, setForm] = useState({
    technicianId: defaultTechId ?? '',
    type: 'vacaciones',
    startDate: '',
    endDate: '',
    note: '',
  })

  function daysCount() {
    if (!form.startDate || !form.endDate) return 0
    const diff = (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000
    return Math.max(0, Math.round(diff) + 1)
  }

  function submitForm() {
    const days = daysCount()
    if (!form.technicianId || !form.startDate || !form.endDate || days <= 0) return
    startTransition(async () => {
      await createLeaveRequest({ ...form, days })
      setShowForm(false)
      setForm({ technicianId: '', type: 'vacaciones', startDate: '', endDate: '', note: '' })
      router.refresh()
    })
  }

  function approve(id: string) {
    startTransition(async () => { await updateLeaveStatus(id, 'aprobado'); router.refresh() })
  }
  function reject(id: string) {
    startTransition(async () => { await updateLeaveStatus(id, 'rechazado'); router.refresh() })
  }
  function remove(id: string) {
    if (!confirm('¿Eliminar esta solicitud?')) return
    startTransition(async () => { await deleteLeaveRequest(id); router.refresh() })
  }

  const filtered = leaves.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false
    if (techFilter && l.technicianId !== techFilter) return false
    return true
  })

  const inputCls = "rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"

  return (
    <div>
      {/* Filters + new */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={techFilter} onChange={e => setTechFilter(e.target.value)} className={inputCls}>
          <option value="">Todos los técnicos</option>
          {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-1">
          {['all', 'pendiente', 'aprobado', 'rechazado'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === s ? 'bg-brand text-ink' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s === 'all' ? 'Todos' : LEAVE_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink hover:bg-brand/90"
        >
          + Registrar permiso
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-5 rounded-xl border border-brand/30 bg-brand/5 p-5">
          <h3 className="mb-4 text-sm font-semibold">Nueva solicitud de permiso</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Técnico *</label>
              <select value={form.technicianId} onChange={e => setForm(f => ({ ...f, technicianId: e.target.value }))} className={`${inputCls} w-full`}>
                <option value="">Seleccionar…</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Tipo *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={`${inputCls} w-full`}>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{LEAVE_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Fecha inicio *</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Fecha fin * {daysCount() > 0 && <span className="text-brand">({daysCount()} días)</span>}</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={`${inputCls} w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Nota (opcional)</label>
              <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Motivo u observación…" className={`${inputCls} w-full`} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-50">
              Cancelar
            </button>
            <button onClick={submitForm} disabled={isPending || daysCount() <= 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-ink hover:bg-brand/90 disabled:opacity-50">
              {isPending && <Spinner size={14} />}
              {isPending ? 'Guardando…' : 'Guardar solicitud'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">Sin solicitudes para los filtros seleccionados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-5 py-3 text-left">Técnico</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Fechas</th>
                <th className="px-4 py-3 text-center">Días</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{l.technician.name}</td>
                  <td className="px-4 py-3 text-gray-600">{LEAVE_TYPE_LABEL[l.type]}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(l.startDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    {' → '}
                    {new Date(l.endDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums font-medium">{l.days}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEAVE_STATUS_BADGE[l.status]}`}>
                      {LEAVE_STATUS_LABEL[l.status]}
                    </span>
                    {l.approvedBy && <span className="ml-1 text-[11px] text-gray-400">({l.approvedBy.name})</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {l.status === 'pendiente' && (
                        <>
                          <button onClick={() => approve(l.id)} disabled={isPending} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">{isPending && <Spinner size={10} />}Aprobar</button>
                          <button onClick={() => reject(l.id)} disabled={isPending} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">{isPending && <Spinner size={10} />}Rechazar</button>
                        </>
                      )}
                      <button onClick={() => remove(l.id)} disabled={isPending} className="rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-100">✕</button>
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
