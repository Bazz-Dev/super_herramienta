import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { ExpenseList } from '@/components/expenses/expense-list'
import { SignaturePendingList } from './signature-pending-list'
import {
  CONTRACT_TYPE_LABELS, CONTRACT_TYPE_BADGE,
  DOC_TYPE_LABELS,
  type ContractTypeId, type DocTypeId,
} from '@/lib/resources/labels'
import {
  LEAVE_TYPE_LABEL, LEAVE_STATUS_BADGE, LEAVE_STATUS_LABEL,
  PAYROLL_STATUS_BADGE, PAYROLL_STATUS_LABEL, MONTH_NAMES, formatClp,
} from '@/lib/rrhh/labels'
import { TecnicoLeaveForm } from '@/components/rrhh/tecnico-leave-form'

// ── helpers ──────────────────────────────────────────────────────────────────

function fDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fShort(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
function fTime(d: Date | string) {
  return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function expiryInfo(d: Date | null | undefined): { label: string; cls: string; icon: string } {
  if (!d) return { label: 'Sin fecha', cls: 'text-gray-400', icon: '—' }
  const days = Math.floor((new Date(d).getTime() - Date.now()) / 86400000)
  const label = fDate(d)
  if (days < 0)   return { label: `${label} · VENCIDO`, cls: 'text-red-600 font-semibold', icon: '🚨' }
  if (days <= 30) return { label: `${label} · ${days}d`, cls: 'text-red-500 font-semibold', icon: '⚠️' }
  if (days <= 90) return { label: `${label} · ${days}d`, cls: 'text-amber-600', icon: '🟡' }
  return { label, cls: 'text-green-600', icon: '✓' }
}

function yearsMonths(from: Date | null | undefined): string {
  if (!from) return '—'
  const ms = Date.now() - new Date(from).getTime()
  const years = Math.floor(ms / (365.25 * 24 * 3600000))
  const months = Math.floor((ms % (365.25 * 24 * 3600000)) / (30.44 * 24 * 3600000))
  if (years === 0) return `${months} mes${months !== 1 ? 'es' : ''}`
  return `${years} año${years !== 1 ? 's' : ''}${months > 0 ? ` ${months}m` : ''}`
}

function hoursLabel(h: number): string {
  if (h < 1) return '< 1 h'
  const d = Math.floor(h / 8)
  const rem = Math.round(h % 8)
  if (d === 0) return `${Math.round(h)} h`
  return `${d}d ${rem > 0 ? `${rem}h` : ''}`.trim()
}

const TICKET_STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', en_revision: 'En revisión', en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esp. aprobación', resuelto: 'Resuelto', cancelado: 'Cancelado', fusionado: 'Fusionado',
}
const TICKET_STATUS_CLS: Record<string, string> = {
  nuevo: 'bg-blue-100 text-blue-700', en_revision: 'bg-purple-100 text-purple-700',
  en_ejecucion: 'bg-amber-100 text-amber-700', esperando_aprobacion: 'bg-orange-100 text-orange-700',
  resuelto: 'bg-green-100 text-green-700', cancelado: 'bg-gray-100 text-gray-500',
}
const URGENCY_CLS: Record<string, string> = {
  emergencia: 'bg-red-100 text-red-700', urgencia: 'bg-orange-100 text-orange-700',
  no_urgente: 'bg-gray-100 text-gray-500', preventivo: 'bg-teal-100 text-teal-700',
}
const URGENCY_LBL: Record<string, string> = {
  emergencia: 'Emergencia', urgencia: 'Urgente', no_urgente: 'Normal', preventivo: 'Preventivo',
}
const ASSIGN_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500',
}
const ASSIGN_STATUS_LBL: Record<string, string> = {
  scheduled: 'Programado', in_progress: 'En ejecución', done: 'Completado', cancelled: 'Cancelado',
}

// ── page ──────────────────────────────────────────────────────────────────────

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
      vehicle: {
        select: {
          plate: true, brand: true, model: true, year: true,
          revTecnicaExpiry: true, soapExpiry: true,
          permisoCirculacionExpiry: true, nextServiceDate: true,
        },
      },
    },
  })
  if (!technician) redirect('/login')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    assignmentRows,
    ticketStats,
    allExpenses,
    recentExpenses,
    leaveRequests,
    pendingLeavesCount,
    lastPayroll,
    techDocs,
    pendingSignatures,
    signedSignatures,
  ] = await Promise.all([
    prisma.assignmentAssignee.findMany({
      where: { technicianId: actor.technicianId },
      include: {
        assignment: {
          select: {
            id: true, title: true, start: true, end: true, status: true,
            permissionRequested: true,
            client: { select: { name: true } },
            ticket: { select: { ticketCode: true, title: true, status: true } },
          },
        },
      },
      orderBy: { assignment: { start: 'desc' } },
    }),

    prisma.ticket.findMany({
      where: { assignedToId: actor.id, tenantId: actor.tenantId, deletedAt: null },
      select: {
        id: true, ticketCode: true, title: true, status: true, urgency: true,
        estimatedDate: true,
        client: { select: { name: true } },
        branch: { select: { name: true } },
        _count: { select: { documents: true } },
        updatedAt: true,
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    }),

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
      take: 8,
    }),

    prisma.leaveRequest.findMany({
      where: { technicianId: actor.technicianId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    prisma.leaveRequest.count({
      where: { technicianId: actor.technicianId, status: 'pendiente' },
    }),

    prisma.payroll.findFirst({
      where: { technicianId: actor.technicianId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),

    prisma.technicianDocument.findMany({
      where: { technicianId: actor.technicianId },
      orderBy: [{ expiryDate: 'asc' }, { uploadedAt: 'desc' }],
    }),

    prisma.signatureRequest.findMany({
      where: { technicianId: actor.technicianId, status: 'pendiente' },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.signatureRequest.findMany({
      where: { technicianId: actor.technicianId, status: { not: 'pendiente' } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ])

  // ── derived stats ─────────────────────────────────────────────────────────
  const completedRows  = assignmentRows.filter(r => r.assignment.status === 'done')
  const scheduledRows  = assignmentRows.filter(r => ['scheduled', 'in_progress'].includes(r.assignment.status))

  const totalHours = completedRows.reduce((s, r) => {
    return s + (new Date(r.assignment.end).getTime() - new Date(r.assignment.start).getTime()) / 3600000
  }, 0)
  const thisMonthHours = completedRows
    .filter(r => new Date(r.assignment.start) >= startOfMonth)
    .reduce((s, r) => s + (new Date(r.assignment.end).getTime() - new Date(r.assignment.start).getTime()) / 3600000, 0)

  const upcoming = assignmentRows
    .filter(r => new Date(r.assignment.start) >= now && r.assignment.status === 'scheduled')
    .sort((a, b) => new Date(a.assignment.start).getTime() - new Date(b.assignment.start).getTime())
    .slice(0, 5)

  const activeTickets = ticketStats.filter(t => !['resuelto', 'cancelado', 'fusionado'].includes(t.status))
  const pendingExpCount = allExpenses.filter(e => e.status === 'pendiente').length
  const approvedThisMonth = allExpenses
    .filter(e => e.status === 'aprobado' && new Date(e.date) >= startOfMonth)
    .reduce((s, e) => s + e.amount, 0)

  const pendingSerialized  = pendingSignatures.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null }))
  const signedSerialized   = signedSignatures.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null }))

  // ── ticket helpers ─────────────────────────────────────────────────────────
  const URGENCY_RANK: Record<string, number> = { emergencia: 0, urgencia: 1, no_urgente: 2, preventivo: 3 }
  // eslint-disable-next-line react-hooks/purity
  const now48h = Date.now() - 48 * 3600000
  const sortedTickets = [...ticketStats].sort((a, b) => {
    const ua = URGENCY_RANK[a.urgency] ?? 4, ub = URGENCY_RANK[b.urgency] ?? 4
    if (ua !== ub) return ua - ub
    if (a.estimatedDate && b.estimatedDate) return new Date(a.estimatedDate).getTime() - new Date(b.estimatedDate).getTime()
    if (a.estimatedDate) return -1
    if (b.estimatedDate) return 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
  const newlyAssigned = sortedTickets.filter(t =>
    new Date(t.updatedAt).getTime() > now48h &&
    !['resuelto', 'cancelado', 'fusionado'].includes(t.status)
  )

  const initials = technician.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── 1. PROFILE HERO ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-2xl font-black text-ink shadow">
            {initials}
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-ink">{technician.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONTRACT_TYPE_BADGE[technician.contractType as ContractTypeId] ?? 'bg-gray-100 text-gray-500'}`}>
                {CONTRACT_TYPE_LABELS[technician.contractType as ContractTypeId]}
              </span>
              {!technician.active && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600">Inactivo</span>
              )}
            </div>
            <p className="text-sm text-gray-600 font-medium">{technician.specialty ?? 'INGEGAR'}</p>

            {/* Info row */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500">
              {technician.hireDate && (
                <span title="Fecha de ingreso">
                  📅 Ingreso: {fDate(technician.hireDate)}
                  <span className="ml-1 text-gray-400">({yearsMonths(technician.hireDate)})</span>
                </span>
              )}
              {technician.rut   && <span>🪪 {technician.rut}</span>}
              {technician.phone && <span>📞 {technician.phone}</span>}
              {technician.email && <span>✉️ {technician.email}</span>}
              {technician.address && <span>📍 {technician.address}</span>}
              {technician.contractType === 'plazo_fijo' && technician.contractEndDate && (
                <span className={expiryInfo(technician.contractEndDate).cls}>
                  📋 Vence contrato: {fDate(technician.contractEndDate)}
                </span>
              )}
            </div>

            {(technician.emergencyContact || technician.emergencyPhone) && (
              <p className="mt-2 text-xs text-gray-400">
                🆘 Emergencia: {technician.emergencyContact}
                {technician.emergencyPhone && <span className="ml-2">{technician.emergencyPhone}</span>}
              </p>
            )}
          </div>

          {/* Salary chip */}
          {technician.baseSalary != null && (
            <div className="shrink-0 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600">Sueldo base</p>
              <p className="text-lg font-bold text-green-700">{formatClp(technician.baseSalary)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. VEHICLE + DOCUMENTS ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Camioneta */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 flex items-center gap-2">
            🚗 Camioneta asignada
          </h2>
          {technician.vehicle ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-ink">
                    {[technician.vehicle.brand, technician.vehicle.model].filter(Boolean).join(' ')}
                    {technician.vehicle.year && <span className="ml-1.5 text-sm font-normal text-gray-500">{technician.vehicle.year}</span>}
                  </p>
                  <p className="font-mono text-sm font-semibold text-gray-600">{technician.vehicle.plate}</p>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-100 divide-y divide-gray-100 text-xs">
                {[
                  { label: 'Revisión técnica',   date: technician.vehicle.revTecnicaExpiry },
                  { label: 'SOAP',               date: technician.vehicle.soapExpiry },
                  { label: 'Permiso circulación', date: technician.vehicle.permisoCirculacionExpiry },
                  { label: 'Próx. mantención',    date: technician.vehicle.nextServiceDate },
                ].map(({ label, date }) => {
                  const { label: dLabel, cls, icon } = expiryInfo(date)
                  return (
                    <div key={label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-gray-500">{label}</span>
                      <span className={`${cls} flex items-center gap-1`}>{icon} {dLabel}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin camioneta asignada actualmente.</p>
          )}
        </div>

        {/* Documentos */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 flex items-center justify-between">
            📄 Mis documentos
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{techDocs.length}</span>
          </h2>
          {techDocs.length === 0 ? (
            <p className="text-sm text-gray-400">Sin documentos cargados.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-xs">
              {techDocs.map(doc => {
                const { label: dLabel, cls, icon } = expiryInfo(doc.expiryDate)
                const href = doc.fileUrl.startsWith('/') || doc.fileUrl.startsWith('http')
                  ? doc.fileUrl
                  : `/api/files?key=${encodeURIComponent(doc.fileUrl)}&type=technician`
                return (
                  <li key={doc.id} className="flex items-center gap-2 py-2.5">
                    <span className="text-base leading-none">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {doc.label ?? DOC_TYPE_LABELS[doc.type as DocTypeId]}
                      </p>
                      {doc.expiryDate && (
                        <p className={`${cls} mt-0.5`}>Vence: {dLabel}</p>
                      )}
                    </div>
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 text-brand hover:underline font-medium">
                      Ver ↗
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── 3. KPI STATS ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { value: assignmentRows.length,   label: 'Trabajos totales',  cls: 'border-blue-200 bg-blue-50',   val: 'text-blue-700' },
          { value: scheduledRows.length,     label: 'En agenda',         cls: 'border-amber-200 bg-amber-50', val: 'text-amber-700' },
          { value: completedRows.length,     label: 'Completados',       cls: 'border-green-200 bg-green-50', val: 'text-green-700' },
          { value: hoursLabel(thisMonthHours), label: 'Horas este mes',  cls: 'border-indigo-200 bg-indigo-50', val: 'text-indigo-700' },
          { value: activeTickets.length,     label: 'Tickets activos',   cls: 'border-purple-200 bg-purple-50', val: 'text-purple-700' },
          { value: pendingExpCount,           label: 'Gastos pend.',     cls: 'border-yellow-200 bg-yellow-50', val: 'text-yellow-700' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border ${k.cls} p-3 text-center`}>
            <p className={`text-2xl font-bold ${k.val}`}>{k.value}</p>
            <p className={`mt-0.5 text-[10px] font-medium ${k.val} opacity-80`}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── 4. ASSIGNMENTS + TICKETS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Próximas asignaciones */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 flex items-center justify-between">
            📅 Próximas asignaciones
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{upcoming.length}</span>
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400">Sin trabajos programados próximamente.</p>
          ) : (
            <ul className="divide-y divide-gray-100 space-y-0">
              {upcoming.map(({ assignment, role }) => (
                <li key={assignment.id} className="py-3 flex items-start gap-2.5">
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${assignment.permissionRequested ? 'bg-green-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{assignment.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fShort(assignment.start)} · {fTime(assignment.start)}–{fTime(assignment.end)}
                      {assignment.client && <span className="ml-1.5 text-gray-400">· {assignment.client.name}</span>}
                    </p>
                    {assignment.ticket && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{assignment.ticket.ticketCode}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                    {role === 'ayudante' ? 'Ayudante' : 'Técnico'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Últimos completados */}
          {completedRows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Últimos completados</p>
              <ul className="space-y-2">
                {completedRows.slice(0, 3).map(({ assignment }) => (
                  <li key={assignment.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                    <span className="truncate flex-1">{assignment.title}</span>
                    <span className="shrink-0 text-gray-400">{fShort(assignment.start)}</span>
                  </li>
                ))}
              </ul>
              {totalHours > 0 && (
                <p className="mt-3 text-xs text-gray-400">
                  Total acumulado: <span className="font-semibold text-gray-600">{hoursLabel(totalHours)}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tickets asignados */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 flex items-center justify-between">
            🎫 Tickets asignados
            <div className="flex items-center gap-1.5">
              {newlyAssigned.length > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {newlyAssigned.length} nuevo{newlyAssigned.length !== 1 ? 's' : ''}
                </span>
              )}
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">{ticketStats.length}</span>
            </div>
          </h2>
          {sortedTickets.length === 0 ? (
            <p className="text-sm text-gray-400">No tienes tickets asignados actualmente.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedTickets.map(t => {
                const isNew = new Date(t.updatedAt).getTime() > now48h && !['resuelto', 'cancelado', 'fusionado'].includes(t.status)
                return (
                  <li key={t.id} className={`py-3 ${isNew ? 'bg-amber-50/60 -mx-5 px-5 first:rounded-t-lg' : ''}`}>
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      {isNew && (
                        <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">NUEVO</span>
                      )}
                      <span className="font-mono text-[10px] text-gray-400">{t.ticketCode}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TICKET_STATUS_CLS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {TICKET_STATUS_LABEL[t.status] ?? t.status}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${URGENCY_CLS[t.urgency] ?? 'bg-gray-100 text-gray-500'}`}>
                        {URGENCY_LBL[t.urgency] ?? t.urgency}
                      </span>
                      {t._count.documents > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                          📎 {t._count.documents}
                        </span>
                      )}
                    </div>
                    <Link href={`/mi-panel/tickets/${t.id}`} className="text-sm font-medium text-ink hover:text-brand truncate block transition">
                      {t.title}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t.client?.name}
                      {t.branch && <span className="ml-1.5">· {t.branch.name}</span>}
                      {t.estimatedDate ? (
                        <span className="ml-1.5 font-medium text-brand">
                          · 📅 {fDate(t.estimatedDate)} {fTime(t.estimatedDate)}
                        </span>
                      ) : (
                        <span className="ml-1.5 text-gray-400">· sin fecha</span>
                      )}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── 5. RR.HH. SUMMARY ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">🏢 Recursos Humanos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          {/* Contrato */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Contrato</p>
            <p className="text-sm font-semibold text-ink">
              {CONTRACT_TYPE_LABELS[technician.contractType as ContractTypeId]}
            </p>
            {technician.hireDate && (
              <p className="text-xs text-gray-500 mt-1">
                Desde {fDate(technician.hireDate)}
                <span className="ml-1.5 text-gray-400">({yearsMonths(technician.hireDate)})</span>
              </p>
            )}
            {technician.contractType === 'plazo_fijo' && technician.contractEndDate && (
              <p className={`text-xs mt-1 ${expiryInfo(technician.contractEndDate).cls}`}>
                Vence: {fDate(technician.contractEndDate)}
              </p>
            )}
            {technician.baseSalary != null && (
              <p className="text-xs text-gray-500 mt-1">Base: {formatClp(technician.baseSalary)}/mes</p>
            )}
            {technician.dailyRate != null && (
              <p className="text-xs text-gray-500 mt-0.5">Jornal: {formatClp(technician.dailyRate)}/día</p>
            )}
          </div>

          {/* Permisos y licencias */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Permisos y licencias
              </p>
              {pendingLeavesCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  {pendingLeavesCount} pendiente{pendingLeavesCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <TecnicoLeaveForm />
            {leaveRequests.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                {leaveRequests.map(lr => (
                  <li key={lr.id} className="text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${LEAVE_STATUS_BADGE[lr.status]}`}>
                        {LEAVE_STATUS_LABEL[lr.status]}
                      </span>
                      <span className="text-gray-500">{LEAVE_TYPE_LABEL[lr.type]}</span>
                    </div>
                    <p className="text-gray-400 mt-0.5">
                      {fShort(lr.startDate)} – {fShort(lr.endDate)} · {lr.days}d
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Última liquidación */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Última liquidación
            </p>
            {!lastPayroll ? (
              <p className="text-xs text-gray-400">Sin liquidaciones emitidas.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PAYROLL_STATUS_BADGE[lastPayroll.status]}`}>
                    {PAYROLL_STATUS_LABEL[lastPayroll.status]}
                  </span>
                  <span className="text-gray-500">{MONTH_NAMES[lastPayroll.month]} {lastPayroll.year}</span>
                </div>
                <p className="text-gray-600">Base: <span className="font-semibold">{formatClp(lastPayroll.baseSalary)}</span></p>
                {lastPayroll.extras > 0 && (
                  <p className="text-green-600">+ extras: {formatClp(lastPayroll.extras)}</p>
                )}
                {lastPayroll.deductions > 0 && (
                  <p className="text-red-500">− descuentos: {formatClp(lastPayroll.deductions)}</p>
                )}
                <p className="font-bold text-ink text-sm pt-1 border-t border-gray-200">
                  Líquido: {formatClp(lastPayroll.baseSalary + lastPayroll.extras - lastPayroll.deductions)}
                </p>
                {lastPayroll.paidAt && (
                  <p className="text-gray-400">Pagado: {fDate(lastPayroll.paidAt)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 6. FES ───────────────────────────────────────────────────────────── */}
      {(pendingSerialized.length > 0 || signedSerialized.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-amber-800 flex items-center gap-2">
            ✍️ Firma electrónica
            {pendingSerialized.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                {pendingSerialized.length}
              </span>
            )}
          </h2>
          <SignaturePendingList pending={pendingSerialized} signed={signedSerialized} />
        </div>
      )}

      {/* ── 7. EXPENSES ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">💸 Reportar gasto</h2>
            {approvedThisMonth > 0 && (
              <span className="text-xs text-green-700 font-semibold">{formatClp(approvedThisMonth)} aprobados este mes</span>
            )}
          </div>
          <ExpenseForm compact />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">📋 Mis últimos gastos</h2>
          <ExpenseList expenses={recentExpenses} canApprove={false} canDelete={true} />
        </div>
      </div>

    </div>
  )
}
