'use client'

import { useState, useTransition } from 'react'
import { updateExpenseStatus, deleteExpense } from '@/app/(app)/gastos/actions'

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
  aprobado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

interface ExpenseRow {
  id: string
  date: Date
  amount: number
  category: string
  status: string
  description: string | null
  receiptUrl: string | null
  rejectedReason: string | null
  technician: { name: string }
  ticket: { ticketCode: string; title: string } | null
  approvedBy: { name: string } | null
}

interface ExpenseListProps {
  expenses: ExpenseRow[]
  canApprove: boolean
  canDelete: boolean
}

function formatClp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function ExpenseList({ expenses, canApprove, canDelete }: ExpenseListProps) {
  const [isPending, startTransition] = useTransition()
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  function approve(id: string) {
    setActionId(id)
    startTransition(async () => {
      await updateExpenseStatus(id, 'aprobado')
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

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    setActionId(id)
    startTransition(async () => {
      await deleteExpense(id)
      setActionId(null)
    })
  }

  if (expenses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
        No hay gastos que mostrar.
      </div>
    )
  }

  return (
    <>
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-ink mb-3">Motivo del rechazo</h3>
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
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Técnico</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-left">Trabajo</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Comprobante</th>
              {(canApprove || canDelete) && <th className="px-4 py-3 text-right">Acciones</th>}
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
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[exp.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[exp.status] ?? exp.status}
                    </span>
                    {exp.rejectedReason && (
                      <p className="mt-0.5 text-xs text-red-500">{exp.rejectedReason}</p>
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
                  {(canApprove || canDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
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
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(exp.id)}
                            disabled={loading}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50 cursor-pointer"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
