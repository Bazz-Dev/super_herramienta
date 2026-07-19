import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { ExpenseList } from '@/components/expenses/expense-list'
import { formatClp } from '@/lib/rrhh/labels'

export const metadata = { title: 'Gastos — INGEGAR' }

export default async function MiPanelGastosPage() {
  const actor = await requireActor()
  if (actor.role !== 'tecnico') redirect('/dashboard')
  if (!actor.technicianId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Tu usuario no tiene un técnico asociado. Contacta al administrador.
      </div>
    )
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [allExpenses, recentExpenses] = await Promise.all([
    prisma.expense.findMany({
      where: { technicianId: actor.technicianId },
      select: { amount: true, status: true, date: true },
    }),
    prisma.expense.findMany({
      where: { technicianId: actor.technicianId },
      include: {
        technician: { select: { name: true } },
        ticket: { select: { ticketCode: true, title: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    }),
  ])

  const pendingCount = allExpenses.filter(e => e.status === 'pendiente').length
  const approvedThisMonth = allExpenses
    .filter(e => e.status === 'aprobado' && new Date(e.date) >= startOfMonth)
    .reduce((s, e) => s + e.amount, 0)
  const totalApproved = allExpenses.filter(e => e.status === 'aprobado').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Gastos</h1>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-lg font-bold text-green-700">{formatClp(approvedThisMonth)}</p>
          <p className="mt-0.5 text-[10px] font-medium text-green-700 opacity-80">Aprobado este mes</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
          <p className="text-lg font-bold text-blue-700">{formatClp(totalApproved)}</p>
          <p className="mt-0.5 text-[10px] font-medium text-blue-700 opacity-80">Aprobado histórico</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center">
          <p className="text-lg font-bold text-yellow-700">{pendingCount}</p>
          <p className="mt-0.5 text-[10px] font-medium text-yellow-700 opacity-80">Pendientes</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">💸 Reportar gasto</h2>
        <ExpenseForm compact />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">📋 Historial de gastos</h2>
        <ExpenseList expenses={recentExpenses} canApprove={false} canDelete={true} />
      </div>
    </div>
  )
}
