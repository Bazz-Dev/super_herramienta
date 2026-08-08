import Link from 'next/link'
import { requireActor, tenantScope } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ExpenseList } from '@/components/expenses/expense-list'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { TechnicianFilter } from '@/components/expenses/technician-filter'
import { TicketSearchFilter } from '@/components/expenses/ticket-search-filter'
import { ExportExpensesButton } from '@/components/expenses/export-expenses-button'
import { FilterBar, FilterPill, FilterClear } from '@/components/ui/filter-bar'

function formatClp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

type StatusFilter = 'all' | 'pendiente' | 'aprobado' | 'pagado' | 'rechazado'

const VALID_STATUSES = ['pendiente', 'aprobado', 'pagado', 'rechazado'] as const

// Solo lectura + filtros + informe exportable (informe #14, cierre): antes
// esta página era también el único punto de ingreso (StaffNewExpense/
// ExpenseForm para staff y técnico). El ingreso real ahora vive donde
// corresponde — un técnico registra el suyo en /mi-panel/gastos (ya
// funcionaba así), y staff lo registra desde la ficha del ticket
// (RegisterExpenseButton, nuevo) — nunca acá. Esta página queda para ver el
// panorama general, filtrar, y exportar; la gestión de gastos ya
// registrados (aprobar/rechazar/pagar/editar/eliminar) se mantiene intacta
// en ExpenseList — eso es gestión, no ingreso.
export default async function GastosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tecnico?: string; cliente?: string; ticket?: string }>
}) {
  const actor = await requireActor()
  const params = await searchParams
  const statusFilter = (params.status ?? 'all') as StatusFilter

  const isValidStatus = VALID_STATUSES.includes(statusFilter as (typeof VALID_STATUSES)[number])
  const statusWhere = isValidStatus
    ? { status: statusFilter as (typeof VALID_STATUSES)[number] }
    : {}
  const technicianWhere = params.tecnico ? { technicianId: params.tecnico } : {}
  const clientWhere = params.cliente ? { ticket: { clientId: params.cliente } } : {}
  const ticketSearch = params.ticket?.trim()
  const ticketSearchWhere = ticketSearch
    ? { ticket: { OR: [{ ticketCode: { contains: ticketSearch } }, { title: { contains: ticketSearch } }] } }
    : {}

  const [expenses, allExpenses, technicians, clients] = await Promise.all([
    prisma.expense.findMany({
      where: {
        ...tenantScope(actor),
        ...statusWhere,
        ...technicianWhere,
        ...clientWhere,
        ...ticketSearchWhere,
      },
      include: {
        technician: { select: { name: true } },
        ticket: { select: { ticketCode: true, title: true, client: { select: { name: true } } } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    }),
    // KPIs — siempre sobre el total, no sobre lo filtrado (mismo criterio de
    // siempre: son montos accionables globales, no un subtotal de la vista).
    prisma.expense.findMany({
      where: { ...tenantScope(actor) },
      select: { amount: true, status: true, paidAt: true },
    }),
    prisma.technician.findMany({
      where: { ...tenantScope(actor), active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      where: tenantScope(actor),
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const pendienteTotal = allExpenses.filter((e) => e.status === 'pendiente').reduce((s, e) => s + e.amount, 0)
  // "Por pagar" — aprobado pero todavía no depositado al técnico. Más accionable
  // que un total histórico: es la lista de pagos pendientes de ejecutar.
  const porPagarTotal = allExpenses.filter((e) => e.status === 'aprobado').reduce((s, e) => s + e.amount, 0)
  const pagadoMesTotal = allExpenses
    .filter((e) => e.status === 'pagado' && e.paidAt && new Date(e.paidAt) >= startOfMonth)
    .reduce((s, e) => s + e.amount, 0)

  const canApprove = actor.role === 'super' || actor.role === 'supervisor'
  const canDelete = actor.role === 'super'
  const isStaff = actor.role === 'super' || actor.role === 'supervisor'

  const TAB_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'aprobado', label: 'Por pagar' },
    { value: 'pagado', label: 'Pagados' },
    { value: 'rechazado', label: 'Rechazados' },
  ]

  // Preserva tecnico/cliente/ticket al cambiar de pestaña de estado — antes
  // el link de estado los descartaba (no existían todavía).
  function statusHref(value: StatusFilter) {
    const qs = new URLSearchParams()
    if (value !== 'all') qs.set('status', value)
    if (params.tecnico) qs.set('tecnico', params.tecnico)
    if (params.cliente) qs.set('cliente', params.cliente)
    if (params.ticket) qs.set('ticket', params.ticket)
    const s = qs.toString()
    return s ? `/gastos?${s}` : '/gastos'
  }

  const hasFilters = isValidStatus || !!params.tecnico || !!params.cliente || !!ticketSearch

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Gastos de terreno</h1>
          <p className="mt-1 text-sm text-gray-500">
            Vista general de gastos reportados por técnicos — el registro se hace desde el ticket o desde /mi-panel/gastos.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-ink">← Dashboard</Link>
      </div>

      {/* KPIs — mismo componente compartido que Dashboard/Flujo de Caja
          (KpiCard: card blanca + borde izquierdo de color), reemplaza el
          estilo de fondo pastel plano que Gastos seguía usando solo — esas
          dos pantallas ya migraron de eso hace tiempo, ver el comentario
          del propio KpiCard. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Pendiente aprobación" value={formatClp(pendienteTotal)} tone="warn" href={statusHref('pendiente')} />
        <KpiCard label="Por pagar" value={formatClp(porPagarTotal)} tone="info" href={statusHref('aprobado')} />
        <KpiCard label="Pagado este mes" value={formatClp(pagadoMesTotal)} tone="good" />
      </div>

      {/* Filtros + exportar */}
      <div className="space-y-2.5">
        <FilterBar action={isStaff ? <ExportExpensesButton expenses={expenses} /> : undefined}>
          <TechnicianFilter technicians={technicians} />
          <ClientFilter clients={clients} basePath="/gastos" />
          <TicketSearchFilter />
          {hasFilters && <FilterClear href="/gastos" />}
        </FilterBar>

        <div className="flex flex-wrap gap-1.5">
          {TAB_FILTERS.map(({ value, label }) => (
            <FilterPill key={value} active={statusFilter === value} href={statusHref(value)}>
              {label}
            </FilterPill>
          ))}
        </div>
      </div>

      <p className="text-xs font-medium text-gray-500">
        {expenses.length} resultado{expenses.length !== 1 ? 's' : ''}
      </p>

      {/* Expense table */}
      <ExpenseList
        expenses={expenses}
        canApprove={canApprove}
        canDelete={canDelete}
        canEditAny={isStaff}
      />
    </div>
  )
}
