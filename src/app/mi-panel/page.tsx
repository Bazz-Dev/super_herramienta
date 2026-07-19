import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { CONTRACT_TYPE_LABELS, CONTRACT_TYPE_BADGE, type ContractTypeId } from '@/lib/resources/labels'
import { formatClp } from '@/lib/rrhh/labels'
import type { TicketStatus } from '@/generated/prisma/enums'

// ── helpers ──────────────────────────────────────────────────────────────────

function fDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
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

const TICKET_STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', en_revision: 'En revisión', en_ejecucion: 'En ejecución',
  esperando_aprobacion: 'Esp. aprobación', resuelto: 'Resuelto', cancelado: 'Cancelado', fusionado: 'Fusionado',
}
const TICKET_STATUS_CLS: Record<string, string> = {
  nuevo: 'bg-blue-100 text-blue-700', en_revision: 'bg-purple-100 text-purple-700',
  en_ejecucion: 'bg-amber-100 text-amber-700', esperando_aprobacion: 'bg-orange-100 text-orange-700',
}
const URGENCY_CLS: Record<string, string> = {
  emergencia: 'bg-red-100 text-red-700', urgencia: 'bg-orange-100 text-orange-700',
  no_urgente: 'bg-gray-100 text-gray-500', preventivo: 'bg-teal-100 text-teal-700',
}
const URGENCY_LBL: Record<string, string> = {
  emergencia: 'Emergencia', urgencia: 'Urgente', no_urgente: 'Normal', preventivo: 'Preventivo',
}
const CLOSED = ['resuelto', 'cancelado', 'fusionado'] as TicketStatus[]

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
          revTecnicaExpiry: true, soapExpiry: true, permisoCirculacionExpiry: true, nextServiceDate: true,
        },
      },
    },
  })
  if (!technician) redirect('/login')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [ticketStats, scheduledCount, completedThisMonthRows, pendingExpAmount, pendingLeavesCount, pendingSignaturesCount] = await Promise.all([
    prisma.ticket.findMany({
      where: { assignedToId: actor.effectiveId, tenantId: actor.tenantId, deletedAt: null, status: { notIn: CLOSED } },
      select: {
        id: true, ticketCode: true, title: true, status: true, urgency: true,
        estimatedDate: true, updatedAt: true,
        client: { select: { name: true } },
        branch: { select: { name: true } },
        _count: { select: { documents: true } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.assignmentAssignee.count({ where: { technicianId: actor.technicianId, assignment: { status: { in: ['scheduled', 'in_progress'] } } } }),
    prisma.assignmentAssignee.findMany({
      where: { technicianId: actor.technicianId, assignment: { status: 'done', start: { gte: startOfMonth } } },
      select: { assignment: { select: { start: true, end: true } } },
    }),
    prisma.expense.aggregate({ where: { technicianId: actor.technicianId, status: 'aprobado' }, _sum: { amount: true } }),
    prisma.leaveRequest.count({ where: { technicianId: actor.technicianId, status: 'pendiente' } }),
    prisma.signatureRequest.count({ where: { technicianId: actor.technicianId, status: 'pendiente' } }),
  ])

  const hoursThisMonth = completedThisMonthRows.reduce((s, r) =>
    s + (new Date(r.assignment.end).getTime() - new Date(r.assignment.start).getTime()) / 3600000, 0)
  const hoursLabel = hoursThisMonth < 1 ? '< 1h' : `${Math.round(hoursThisMonth)}h`
  const pendingReview = pendingLeavesCount + pendingSignaturesCount

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
  }).slice(0, 5)
  const newlyAssigned = ticketStats.filter(t => new Date(t.updatedAt).getTime() > now48h)

  const initials = technician.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5 max-w-5xl">

      {/* ── PROFILE HERO ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-2xl font-black text-ink shadow">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-ink">{technician.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONTRACT_TYPE_BADGE[technician.contractType as ContractTypeId] ?? 'bg-gray-100 text-gray-500'}`}>
                {CONTRACT_TYPE_LABELS[technician.contractType as ContractTypeId]}
              </span>
            </div>
            <p className="text-sm text-gray-600 font-medium">{technician.specialty ?? 'INGEGAR'}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-gray-500">
              {technician.hireDate && (
                <span>📅 Ingreso: {fDate(technician.hireDate)} <span className="text-gray-400">({yearsMonths(technician.hireDate)})</span></span>
              )}
              {technician.phone && <span>📞 {technician.phone}</span>}
            </div>
          </div>
          {technician.baseSalary != null && (
            <div className="shrink-0 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600">Sueldo base</p>
              <p className="text-lg font-bold text-green-700">{formatClp(technician.baseSalary)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs del mes ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 text-center">
          <p className="text-2xl font-bold text-purple-700">{ticketStats.length}</p>
          <p className="mt-0.5 text-[11px] font-medium text-purple-700 opacity-80">Tickets activos</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center">
          <p className="text-2xl font-bold text-indigo-700">{hoursLabel}</p>
          <p className="mt-0.5 text-[11px] font-medium text-indigo-700 opacity-80">Horas este mes</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{formatClp(pendingExpAmount._sum.amount ?? 0)}</p>
          <p className="mt-0.5 text-[11px] font-medium text-blue-700 opacity-80">Por cobrar</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{scheduledCount}</p>
          <p className="mt-0.5 text-[11px] font-medium text-amber-700 opacity-80">En agenda</p>
        </div>
      </div>

      {pendingReview > 0 && (
        <Link href="/mi-panel/rrhh" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 transition hover:bg-amber-100">
          <span>⚠️</span>
          <span className="flex-1">
            Tienes {pendingReview} trámite{pendingReview !== 1 ? 's' : ''} en RR.HH. esperando revisión (permisos y/o firmas)
          </span>
          <span className="font-semibold">Ver →</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Camioneta */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 flex items-center gap-2">🚗 Camioneta asignada</h2>
          {technician.vehicle ? (
            <div className="space-y-3">
              <div>
                <p className="text-base font-bold text-ink">
                  {[technician.vehicle.brand, technician.vehicle.model].filter(Boolean).join(' ')}
                  {technician.vehicle.year && <span className="ml-1.5 text-sm font-normal text-gray-500">{technician.vehicle.year}</span>}
                </p>
                <p className="font-mono text-sm font-semibold text-gray-600">{technician.vehicle.plate}</p>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 divide-y divide-gray-100 text-xs">
                {[
                  { label: 'Revisión técnica', date: technician.vehicle.revTecnicaExpiry },
                  { label: 'SOAP', date: technician.vehicle.soapExpiry },
                  { label: 'Permiso circulación', date: technician.vehicle.permisoCirculacionExpiry },
                  { label: 'Próx. mantención', date: technician.vehicle.nextServiceDate },
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

        {/* Tickets asignados (activos, top 5 por urgencia) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 flex items-center justify-between">
            🎫 Tickets urgentes
            <div className="flex items-center gap-1.5">
              {newlyAssigned.length > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {newlyAssigned.length} nuevo{newlyAssigned.length !== 1 ? 's' : ''}
                </span>
              )}
              <Link href="/mi-panel/tickets" className="text-xs font-medium text-brand-700 hover:underline">Ver todos →</Link>
            </div>
          </h2>
          {sortedTickets.length === 0 ? (
            <p className="text-sm text-gray-400">No tienes tickets activos.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedTickets.map(t => {
                const isNew = new Date(t.updatedAt).getTime() > now48h
                return (
                  <li key={t.id} className={`py-3 ${isNew ? 'bg-amber-50/60 -mx-5 px-5 first:rounded-t-lg' : ''}`}>
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      {isNew && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">NUEVO</span>}
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
                      {t.client?.name}{t.branch && <span className="ml-1.5">· {t.branch.name}</span>}
                      {t.estimatedDate && <span className="ml-1.5 font-medium text-brand">· 📅 {fDate(t.estimatedDate)}</span>}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
          {completedThisMonthRows.length > 0 && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
              {completedThisMonthRows.length} trabajo{completedThisMonthRows.length !== 1 ? 's' : ''} completado{completedThisMonthRows.length !== 1 ? 's' : ''} este mes — ver historial en <Link href="/mi-panel/agenda" className="text-brand-700 hover:underline">Mi agenda</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
