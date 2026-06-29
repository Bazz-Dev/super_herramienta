import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { ExpenseList } from '@/components/expenses/expense-list'

function formatClp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

export default async function MiPanelPage() {
  const actor = await requireActor()

  if (actor.role !== 'tecnico') redirect('/dashboard')
  if (!actor.technicianId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Tu usuario no tiene un técnico asociado. Contacta al administrador.
      </div>
    )
  }

  const technician = await prisma.technician.findUnique({
    where: { id: actor.technicianId },
    include: {
      vehicle: { select: { plate: true, brand: true, model: true } },
    },
  })

  if (!technician) redirect('/login')

  // Expenses: last 10
  const expenses = await prisma.expense.findMany({
    where: { technicianId: actor.technicianId },
    include: {
      technician: { select: { name: true } },
      ticket: { select: { ticketCode: true, title: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: 10,
  })

  // Stats
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const allMyExpenses = await prisma.expense.findMany({
    where: { technicianId: actor.technicianId },
    select: { amount: true, status: true, date: true },
  })

  const pendienteCount = allMyExpenses.filter((e) => e.status === 'pendiente').length
  const aprobadoMes = allMyExpenses
    .filter((e) => e.status === 'aprobado' && new Date(e.date) >= startOfMonth)
    .reduce((s, e) => s + e.amount, 0)

  // Assignment count (trabajos scheduled/done)
  const trabajosCount = await prisma.assignmentAssignee.count({
    where: { technicianId: actor.technicianId },
  })

  return (
    <div className="space-y-8">
      {/* Welcome card */}
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-6">
        <h1 className="text-2xl font-bold text-ink">Hola, {technician.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {technician.specialty ?? 'Técnico INGEGAR'}
          {technician.vehicle && (
            <span className="ml-3 text-gray-400">
              · Camioneta: {technician.vehicle.brand} {technician.vehicle.model} ({technician.vehicle.plate})
            </span>
          )}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Trabajos asignados</p>
          <p className="mt-1 text-3xl font-bold text-ink">{trabajosCount}</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-yellow-700">Gastos pendientes</p>
          <p className="mt-1 text-3xl font-bold text-yellow-900">{pendienteCount}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-green-700">Aprobado este mes</p>
          <p className="mt-1 text-2xl font-bold text-green-900">{formatClp(aprobadoMes)}</p>
        </div>
      </div>

      {/* Quick expense form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-ink">Reportar un gasto</h2>
        <ExpenseForm compact />
      </div>

      {/* Expense history */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-ink">Mis últimos gastos</h2>
        <ExpenseList
          expenses={expenses}
          canApprove={false}
          canDelete={true}
        />
      </div>
    </div>
  )
}
