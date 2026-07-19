import Link from 'next/link'
import { requireActor, tenantScope } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ExpenseList } from '@/components/expenses/expense-list'
import { StaffNewExpense } from '@/components/expenses/staff-new-expense'
import { ExpenseForm } from '@/components/expenses/expense-form'

function formatClp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

type StatusFilter = 'all' | 'pendiente' | 'aprobado' | 'pagado' | 'rechazado'

const VALID_STATUSES = ['pendiente', 'aprobado', 'pagado', 'rechazado'] as const

export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const actor = await requireActor()
  const params = await searchParams
  const statusFilter = (params.status ?? 'all') as StatusFilter

  const isValidStatus = VALID_STATUSES.includes(statusFilter as (typeof VALID_STATUSES)[number])
  const statusWhere = isValidStatus
    ? { status: statusFilter as (typeof VALID_STATUSES)[number] }
    : {}

  const expenses = await prisma.expense.findMany({
    where: {
      ...tenantScope(actor),
      ...statusWhere,
    },
    include: {
      technician: { select: { name: true } },
      ticket: { select: { ticketCode: true, title: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })

  // KPIs from all expenses (no status filter)
  const allExpenses = await prisma.expense.findMany({
    where: { ...tenantScope(actor) },
    select: { amount: true, status: true, paidAt: true },
  })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const pendienteTotal = allExpenses.filter((e) => e.status === 'pendiente').reduce((s, e) => s + e.amount, 0)
  // "Por pagar" — aprobado pero todavía no depositado al técnico. Más accionable
  // que un total histórico: es la lista de pagos pendientes de ejecutar.
  const porPagarTotal = allExpenses.filter((e) => e.status === 'aprobado').reduce((s, e) => s + e.amount, 0)
  const pagadoMesTotal = allExpenses
    .filter((e) => e.status === 'pagado' && e.paidAt && new Date(e.paidAt) >= startOfMonth)
    .reduce((s, e) => s + e.amount, 0)

  // Technicians for the staff expense form
  const technicians = await prisma.technician.findMany({
    where: { ...tenantScope(actor), active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const canApprove = actor.role === 'super' || actor.role === 'supervisor'
  const canDelete = actor.role === 'super'
  const isStaff = actor.role === 'super' || actor.role === 'supervisor'
  const isTecnico = actor.role === 'tecnico'

  const TAB_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'aprobado', label: 'Por pagar' },
    { value: 'pagado', label: 'Pagados' },
    { value: 'rechazado', label: 'Rechazados' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Gastos de terreno</h1>
          <p className="mt-1 text-sm text-gray-500">Gestión de gastos reportados por técnicos</p>
        </div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-ink">← Dashboard</Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-yellow-700">Pendiente aprobación</p>
          <p className="mt-1 text-2xl font-bold text-yellow-900">{formatClp(pendienteTotal)}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-700">Por pagar</p>
          <p className="mt-1 text-2xl font-bold text-blue-900">{formatClp(porPagarTotal)}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-green-700">Pagado este mes</p>
          <p className="mt-1 text-2xl font-bold text-green-900">{formatClp(pagadoMesTotal)}</p>
        </div>
      </div>

      {/* New expense form */}
      {isStaff && technicians.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-ink">Registrar gasto para un técnico</h2>
          <StaffNewExpense technicians={technicians} />
        </div>
      )}
      {isTecnico && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-base font-semibold text-ink">Registrar mi gasto</h2>
          <ExpenseForm />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TAB_FILTERS.map(({ value, label }) => (
          <Link
            key={value}
            href={value === 'all' ? '/gastos' : `/gastos?status=${value}`}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === value
                ? 'border-brand text-ink'
                : 'border-transparent text-gray-500 hover:text-ink'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Expense table */}
      <ExpenseList
        expenses={expenses}
        canApprove={canApprove}
        canDelete={canDelete}
      />
    </div>
  )
}
