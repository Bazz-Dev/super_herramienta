'use client'

import { useState, useTransition } from 'react'
import { updateExpenseStatus, updateExpense, deleteExpense } from '@/app/(app)/gastos/actions'
import { Modal } from '@/components/resources/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { expenseClassification, EXPENSE_CLASSIFICATION_LABELS, EXPENSE_CLASSIFICATION_COLORS } from '@/lib/expenses/expense-presets'

const CATEGORY_LABELS: Record<string, string> = {
  combustible: 'Combustible',
  estacionamiento: 'Estacionamiento',
  materiales: 'Materiales',
  viatico: 'Viático',
  herramienta: 'Herramienta',
  otro: 'Otro',
}

const STATUS_BADGE: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  aprobado: 'bg-blue-100 text-blue-800',
  pagado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado · por pagar',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
}

interface ExpenseRow {
  id: string
  date: Date
  amount: number
  category: string
  status: string
  description: string | null
  supplier: string | null
  receiptUrl: string | null
  rejectedReason: string | null
  paidAt: Date | null
  ticketId: string | null
  jobId: string | null
  isGeneral: boolean | null
  technician: { name: string }
  ticket: { ticketCode: string; title: string } | null
  approvedBy: { name: string } | null
}

interface ExpenseListProps {
  expenses: ExpenseRow[]
  canApprove: boolean
  canDelete: boolean
  /** Puede editar cualquier gasto en cualquier estado — staff. Sin esto, solo
   * el propio técnico puede editar y solo mientras sigue "pendiente"
   * (aplicado igual server-side en updateExpense, esto es solo la UI). */
  canEditAny?: boolean
}

function formatClp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ExpenseList({ expenses, canApprove, canDelete, canEditAny = false }: ExpenseListProps) {
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editModal, setEditModal] = useState<ExpenseRow | null>(null)
  // window.confirm() está prohibido para acciones destructivas (frontend.md)
  // -- confirmación inline en su lugar, mismo patrón ya usado en el resto de
  // la app (doc-section.tsx, portal-new-ticket-form.tsx, etc.).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function approve(id: string) {
    setActionId(id)
    startTransition(async () => {
      await updateExpenseStatus(id, 'aprobado')
      setActionId(null)
    })
  }

  function markPaid(id: string) {
    setActionId(id)
    startTransition(async () => {
      await updateExpenseStatus(id, 'pagado')
      setActionId(null)
    })
  }

  function openReject(id: string) {
    setRejectReason('')
    setRejectModal({ id })
  }

  function confirmReject() {
    if (!rejectModal) return
    const id = rejectModal.id
    setRejectModal(null)
    setActionId(id)
    startTransition(async () => {
      await updateExpenseStatus(id, 'rechazado', rejectReason || undefined)
      setActionId(null)
    })
  }

  function doDelete(id: string) {
    setConfirmDeleteId(null)
    setActionId(id)
    startTransition(async () => {
      await deleteExpense(id)
      setActionId(null)
    })
  }

  if (expenses.length === 0) {
    return <EmptyState title="No hay gastos que mostrar." />
  }

  return (
    <>
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Motivo del rechazo">
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder="Opcional: explica el motivo…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
        />
        <div className="mt-4 flex gap-2 justify-end">
          <button
            onClick={() => setRejectModal(null)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={confirmReject}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
          >
            Rechazar
          </button>
        </div>
      </Modal>

      <EditExpenseModal expense={editModal} onClose={() => setEditModal(null)} />

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Técnico</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-left">Ticket</th>
              <th className="px-4 py-3 text-left">Clasificación</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Comprobante</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expenses.map((exp) => {
              const loading = isPending && actionId === exp.id
              return (
                <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(exp.date)}</td>
                  <td className="px-4 py-3 font-medium text-ink">{exp.technician.name}</td>
                  <td className="px-4 py-3 text-gray-600">{CATEGORY_LABELS[exp.category] ?? exp.category}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-ink">{formatClp(exp.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {exp.ticket ? (
                      <span className="text-xs">{exp.ticket.ticketCode}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const cls = expenseClassification(exp)
                      return (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${EXPENSE_CLASSIFICATION_COLORS[cls]}`}>
                          {EXPENSE_CLASSIFICATION_LABELS[cls]}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[exp.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[exp.status] ?? exp.status}
                    </span>
                    {exp.status === 'pagado' && exp.paidAt && (
                      <p className="mt-0.5 text-xs text-gray-400">{formatDate(exp.paidAt)}</p>
                    )}
                    {exp.rejectedReason && (
                      <p className="mt-0.5 text-xs text-red-500">{exp.rejectedReason}</p>
                    )}
                    {exp.description && (
                      <p className="mt-0.5 max-w-[16rem] truncate text-xs text-gray-400" title={exp.description}>{exp.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {exp.receiptUrl ? (
                      <a
                        href={exp.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand underline hover:no-underline"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  {(() => {
                    const canEdit = canEditAny || exp.status === 'pendiente'
                    return (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button
                            onClick={() => setEditModal(exp)}
                            disabled={loading}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                          >
                            Editar
                          </button>
                        )}
                        {canApprove && exp.status === 'pendiente' && (
                          <>
                            <button
                              onClick={() => approve(exp.id)}
                              disabled={loading}
                              className="rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 cursor-pointer"
                            >
                              Aprobar
                            </button>
                            <button
                              onClick={() => openReject(exp.id)}
                              disabled={loading}
                              className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                        {canApprove && exp.status === 'aprobado' && (
                          <button
                            onClick={() => markPaid(exp.id)}
                            disabled={loading}
                            className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-ink hover:opacity-90 disabled:opacity-50 cursor-pointer"
                          >
                            Marcar pagado
                          </button>
                        )}
                        {canDelete && (
                          confirmDeleteId === exp.id ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1">
                              <span className="text-xs font-medium text-red-700">¿Eliminar?</span>
                              <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">No</button>
                              <button type="button" onClick={() => doDelete(exp.id)} disabled={loading} className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50 cursor-pointer">
                                {loading ? '…' : 'Sí'}
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(exp.id)}
                              disabled={loading}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                            >
                              Eliminar
                            </button>
                          )
                        )}
                      </div>
                    </td>
                    )
                  })()}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// Edición completa (informe #14) — el ticket queda como texto de solo
// lectura acá (reasignar a otro ticket es una decisión mayor, no un typo de
// captura); lo editable es lo que realmente se corrige seguido: monto,
// categoría, proveedor, descripción, fecha, y la clasificación "general"
// cuando no tiene ticket.
function EditExpenseModal({ expense, onClose }: { expense: ExpenseRow | null; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()

  if (!expense) return null

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateExpense(expense!.id, fd)
      onClose()
    })
  }

  const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <Modal open={!!expense} onClose={onClose} title="Editar gasto">
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="ticketId" value={expense.ticketId ?? ''} />
        <input type="hidden" name="jobId" value={expense.jobId ?? ''} />
        {expense.ticket && (
          <p className="text-xs text-gray-500">Ticket: <span className="font-medium text-gray-700">{expense.ticket.ticketCode}</span> (no editable acá)</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Categoría</label>
            <select name="category" defaultValue={expense.category} className={inputCls}>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Monto (CLP)</label>
            <input name="amount" type="number" min={1} defaultValue={expense.amount} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Fecha</label>
            <input name="date" type="date" defaultValue={new Date(expense.date).toISOString().slice(0, 10)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Proveedor</label>
            <input name="supplier" type="text" defaultValue={expense.supplier ?? ''} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Descripción</label>
          <textarea name="description" rows={2} defaultValue={expense.description ?? ''} className={inputCls} />
        </div>
        {!expense.ticketId && (
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" name="isGeneral" defaultChecked={expense.isGeneral === true} className="rounded" />
            Es un gasto general de la empresa (no corresponde a un ticket puntual)
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:opacity-90 disabled:opacity-50 cursor-pointer">
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
