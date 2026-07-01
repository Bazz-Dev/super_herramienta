import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { ExpenseList } from '@/components/expenses/expense-list'
import { SignaturePendingList } from './signature-pending-list'

function formatClp(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(d: Date | string) {
  return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Programado',
  in_progress: 'En ejecución',
  done: 'Completado',
  cancelled: 'Cancelado',
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  en_revision: 'En revisión',
  en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esperando aprobación',
  resuelto: 'Resuelto',
  cancelado: 'Cancelado',
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

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // All queries in parallel
  const [assignmentRows, myExpenses, expenses, ticketStats, pendingSignatures, signedSignatures] = await Promise.all([
    // Assignments via AssignmentAssignee (technicianId = Technician.id ✓)
    prisma.assignmentAssignee.findMany({
      where: { technicianId: actor.technicianId },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
            start: true,
            end: true,
            status: true,
            permissionRequested: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { assignment: { start: 'desc' } },
    }),

    // Expense stats
    prisma.expense.findMany({
      where: { technicianId: actor.technicianId },
      select: { amount: true, status: true, date: true },
    }),

    // Last 10 expenses with details
    prisma.expense.findMany({
      where: { technicianId: actor.technicianId },
      include: {
        technician: { select: { name: true } },
        ticket: { select: { ticketCode: true, title: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 10,
    }),

    // Tickets assigned via User account (assignedToId = User.id, not Technician.id)
    prisma.ticket.findMany({
      where: { assignedToId: actor.id, tenantId: actor.tenantId },
      select: {
        id: true,
        ticketCode: true,
        title: true,
        status: true,
        urgency: true,
        client: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),

    // Pending signature requests
    prisma.signatureRequest.findMany({
      where: { technicianId: actor.technicianId, status: 'pendiente' },
      orderBy: { createdAt: 'desc' },
    }),

    // Signature history
    prisma.signatureRequest.findMany({
      where: { technicianId: actor.technicianId, status: { not: 'pendiente' } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ])

  const pendingSerialized = pendingSignatures.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null }))
  const signedSerialized = signedSignatures.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null }))

  // Stats from assignments
  const totalAsignaciones = assignmentRows.length
  const enAgenda = assignmentRows.filter((r) => r.assignment.status === 'scheduled' || r.assignment.status === 'in_progress').length
  const completadas = assignmentRows.filter((r) => r.assignment.status === 'done').length

  // Upcoming assignments (future, sorted asc)
  const upcoming = assignmentRows
    .filter((r) => new Date(r.assignment.start) >= now && r.assignment.status === 'scheduled')
    .sort((a, b) => new Date(a.assignment.start).getTime() - new Date(b.assignment.start).getTime())
    .slice(0, 5)

  // Recent completed (last 3)
  const recentDone = assignmentRows
    .filter((r) => r.assignment.status === 'done')
    .sort((a, b) => new Date(b.assignment.start).getTime() - new Date(a.assignment.start).getTime())
    .slice(0, 3)

  // Expense stats
  const pendienteCount = myExpenses.filter((e) => e.status === 'pendiente').length
  const aprobadoMes = myExpenses
    .filter((e) => e.status === 'aprobado' && new Date(e.date) >= startOfMonth)
    .reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-8">
      {/* Welcome card */}
      <div className="rounded-xl border border-brand/30 bg-brand/5 p-5">
        <h1 className="text-2xl font-bold text-ink">Hola, {technician.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {technician.specialty ?? 'Técnico INGEGAR'}
          {technician.vehicle && (
            <span className="ml-3 text-gray-400">
              · {technician.vehicle.brand} {technician.vehicle.model} ({technician.vehicle.plate})
            </span>
          )}
        </p>
      </div>

      {/* FES — Firma Electrónica Simple */}
      {(pendingSerialized.length > 0 || signedSerialized.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${pendingSerialized.length > 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {pendingSerialized.length}
            </span>
            Documentos pendientes de firma
          </h2>
          <SignaturePendingList pending={pendingSerialized} signed={signedSerialized} />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-3xl font-bold text-blue-700">{totalAsignaciones}</p>
          <p className="mt-1 text-xs text-blue-600 font-medium">Trabajos totales</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-3xl font-bold text-amber-700">{enAgenda}</p>
          <p className="mt-1 text-xs text-amber-600 font-medium">En agenda</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{completadas}</p>
          <p className="mt-1 text-xs text-green-600 font-medium">Completados</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
          <p className="text-3xl font-bold text-yellow-700">{pendienteCount}</p>
          <p className="mt-1 text-xs text-yellow-600 font-medium">Gastos pendientes</p>
        </div>
      </div>

      {/* Upcoming assignments */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-base font-semibold text-ink">Próximas asignaciones</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">No tienes trabajos programados próximamente.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.map(({ assignment, role }) => (
              <li key={assignment.id} className="flex items-start gap-3 py-3">
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${assignment.permissionRequested ? 'bg-green-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{assignment.title}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(assignment.start)} · {formatTime(assignment.start)} – {formatTime(assignment.end)}
                    {assignment.client && <span className="ml-2 text-gray-400">· {assignment.client.name}</span>}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {role === 'ayudante' ? 'Ayudante' : 'Técnico'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent completed */}
      {recentDone.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Trabajos recientes completados</h2>
          <ul className="divide-y divide-gray-100">
            {recentDone.map(({ assignment }) => (
              <li key={assignment.id} className="flex items-center gap-3 py-3">
                <div className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{assignment.title}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(assignment.start)}
                    {assignment.client && <span className="ml-2">· {assignment.client.name}</span>}
                  </p>
                </div>
                <span className="text-xs text-green-600 font-medium">Completado ✓</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tickets assigned to this user */}
      {ticketStats.length > 0 && (
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-5">
          <h2 className="mb-3 text-base font-semibold text-ink">Tickets asignados</h2>
          <ul className="divide-y divide-purple-100">
            {ticketStats.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {t.ticketCode}
                    {t.client && <span className="ml-2">· {t.client.name}</span>}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white border border-purple-200 px-2 py-0.5 text-xs text-purple-700">
                  {TICKET_STATUS_LABELS[t.status] ?? t.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Approved this month */}
      <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-3">
        <p className="text-sm font-medium text-green-800">Gastos aprobados este mes</p>
        <p className="text-xl font-bold text-green-700">{formatClp(aprobadoMes)}</p>
      </div>

      {/* Quick expense form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-ink">Reportar un gasto</h2>
        <ExpenseForm compact />
      </div>

      {/* Expense history */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-ink">Mis últimos gastos</h2>
        <ExpenseList expenses={expenses} canApprove={false} canDelete={true} />
      </div>
    </div>
  )
}
