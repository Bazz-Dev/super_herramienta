import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { CONTRACT_TYPE_LABELS, CONTRACT_TYPE_ACTIVE, type ContractTypeId } from '@/lib/resources/labels'
import { LEAVE_TYPE_LABEL, LEAVE_STATUS_BADGE, LEAVE_STATUS_LABEL, formatClp } from '@/lib/rrhh/labels'
import { TecnicoLeaveForm } from '@/components/rrhh/tecnico-leave-form'

// ── helpers ──────────────────────────────────────────────────────

function fDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function calcAccruedVacationDays(hireDate: Date | null): number {
  if (!hireDate) return 0
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000
  const yearsWorked = (Date.now() - new Date(hireDate).getTime()) / msPerYear
  return Math.floor(yearsWorked * 15)
}

const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  combustible:    'Combustible',
  estacionamiento:'Estacionamiento',
  materiales:     'Materiales',
  viatico:        'Viático',
  herramienta:    'Herramienta',
  otro:           'Otro',
}

const EXPENSE_STATUS_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border border-amber-200',
  aprobado:  'bg-green-50 text-green-700 border border-green-200',
  rechazado: 'bg-red-50 text-red-600 border border-red-200',
}

const EXPENSE_STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado:  'Aprobado',
  rechazado: 'Rechazado',
}

// ── page ─────────────────────────────────────────────────────────

export default async function MiPanelPage() {
  const session = await auth()
  if (!session?.user?.technicianId) redirect('/dashboard')

  const technicianId = session.user.technicianId
  const tenantId = session.user.tenantId

  const [tech, assignments, pendingLeaves, pendingFES, recentExpenses] = await Promise.all([
    prisma.technician.findFirst({
      where: { id: technicianId, tenantId },
      include: {
        vehicle: { select: { plate: true, brand: true, model: true } },
        leaveRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    }),
    prisma.assignment.findMany({
      where: {
        tenantId,
        assignees: { some: { technicianId } },
        start: { gte: new Date() },
        status: { notIn: ['done', 'cancelled'] },
      },
      include: { client: { select: { name: true } } },
      orderBy: { start: 'asc' },
      take: 5,
    }),
    prisma.leaveRequest.findMany({
      where: { technicianId, status: 'pendiente' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.signatureRequest.findMany({
      where: { technicianId, status: 'pendiente' },
      select: { id: true, documentTitle: true, documentType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.findMany({
      where: { technicianId },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, amount: true, category: true, date: true, status: true, description: true },
    }),
  ])

  if (!tech) redirect('/dashboard')

  const isActive = tech.active && CONTRACT_TYPE_ACTIVE.includes(tech.contractType as ContractTypeId)
  const accrued = calcAccruedVacationDays(tech.hireDate)
  const usedDays = tech.leaveRequests
    .filter(l => l.type === 'vacaciones' && l.status === 'aprobado')
    .reduce((s, l) => s + l.days, 0)
  const availableDays = Math.max(0, accrued - usedDays)

  const vehicleLabel = tech.vehicle
    ? `${tech.vehicle.plate} · ${tech.vehicle.brand} ${tech.vehicle.model}`
    : 'Sin vehículo'

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">

      {/* ── Hero card ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-2xl font-bold text-brand">
            {tech.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{tech.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
              {tech.rut && <span>{tech.rut}</span>}
              {tech.specialty && <><span>·</span><span>{tech.specialty}</span></>}
              <span>·</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                isActive
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-600 border border-red-200'
              }`}>
                {CONTRACT_TYPE_LABELS[tech.contractType as ContractTypeId] ?? tech.contractType}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-gray-400">
              {tech.phone && <span>{tech.phone}</span>}
              {tech.phone2 && <span>{tech.phone2}</span>}
              {tech.mutualidad && <span>Mutualidad: {tech.mutualidad}</span>}
            </div>
          </div>
        </div>

        {/* KPI chips */}
        <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: 'Ingreso', value: fDate(tech.hireDate) },
            { label: 'Contrato', value: CONTRACT_TYPE_LABELS[tech.contractType as ContractTypeId] ?? tech.contractType },
            { label: 'Vacaciones', value: `${availableDays} días` },
            { label: 'Sueldo', value: tech.baseSalary ? formatClp(tech.baseSalary) : '—' },
            { label: 'Mutualidad', value: tech.mutualidad ?? '—' },
            { label: 'Vehículo', value: vehicleLabel },
          ].map(kpi => (
            <div key={kpi.label} className="rounded-xl bg-gray-50 p-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{kpi.label}</p>
              <p className="mt-0.5 text-xs font-medium text-gray-700 leading-tight">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-column grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

        {/* Left column */}
        <div className="space-y-6">

          {/* Solicitar permiso */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Solicitar permiso</h2>
              {pendingLeaves.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {pendingLeaves.length} pendiente{pendingLeaves.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="p-5">
              <TecnicoLeaveForm />
            </div>
          </section>

          {/* Mis solicitudes */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Mis solicitudes</h2>
              <span className="text-xs text-gray-400">{tech.leaveRequests.length} registros</span>
            </div>
            <div className="divide-y divide-gray-50">
              {tech.leaveRequests.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin solicitudes registradas</p>
              )}
              {tech.leaveRequests.map(l => (
                <div key={l.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{LEAVE_TYPE_LABEL[l.type] ?? l.type}</p>
                    <p className="text-[11px] text-gray-400">
                      {fDate(l.startDate)} → {fDate(l.endDate)} · {l.days} día{l.days !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEAVE_STATUS_BADGE[l.status] ?? ''}`}>
                    {LEAVE_STATUS_LABEL[l.status] ?? l.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Próximos trabajos */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Próximos trabajos</h2>
              <Link href="/cronograma" className="text-xs font-medium text-brand hover:underline">
                Ver cronograma →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {assignments.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin trabajos programados</p>
              )}
              {assignments.map(a => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
                    {fDate(a.start).slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-700">
                      {a.title ?? '—'}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {a.client?.name ?? '—'} · {fDate(a.start)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Mis gastos recientes */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Mis gastos recientes</h2>
              <Link href="/gastos" className="text-xs font-medium text-brand hover:underline">
                + Registrar gasto
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recentExpenses.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin gastos registrados</p>
              )}
              {recentExpenses.map(exp => (
                <div key={exp.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">
                      {EXPENSE_CATEGORY_LABEL[exp.category] ?? exp.category}
                      {exp.description && <span className="font-normal text-gray-400"> · {exp.description}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">{fDate(exp.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">{formatClp(exp.amount)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${EXPENSE_STATUS_BADGE[exp.status] ?? ''}`}>
                      {EXPENSE_STATUS_LABEL[exp.status] ?? exp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Documentos pendientes de firma */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Documentos pendientes de firma</h2>
              {pendingFES.length > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  {pendingFES.length}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-50">
              {pendingFES.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin documentos pendientes</p>
              )}
              {pendingFES.map(sig => (
                <div key={sig.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{sig.documentTitle}</p>
                    <p className="text-[11px] text-gray-400">{sig.documentType} · {fDate(sig.createdAt)}</p>
                  </div>
                  <Link
                    href={`/mi-panel/firma/${sig.id}`}
                    className="rounded-lg bg-brand px-3 py-1 text-[11px] font-semibold text-white hover:bg-brand/90"
                  >
                    Firmar
                  </Link>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
