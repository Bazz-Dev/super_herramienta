import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TechnicianForm } from '@/components/resources/technician-form'
import { DocSection } from '@/components/resources/doc-section'
import { TechnicianProfileShell } from '@/components/resources/technician-profile-shell'
import { requireActor } from '@/lib/tenant'
import { getTechnician } from '@/lib/resources/technicians'
import { prisma } from '@/lib/prisma'
import {
  ASSET_STATUS_LABELS,
  CONTRACT_TYPE_BADGE,
  CONTRACT_TYPE_LABELS,
  type AssetStatusId,
  type ContractTypeId,
} from '@/lib/resources/labels'
import {
  STATUS_DOT,
  STATUS_LABEL,
  type TicketStatusId,
} from '@/lib/tickets/labels'
import { updateTechnician } from '../actions'

function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(d: Date | string | null): string {
  if (!d) return '—'
  const val = d instanceof Date ? d.toISOString().slice(0, 10) : String(d)
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(val)
  const dt = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(val)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('es-CL', { dateStyle: 'medium' })
}

function calcAge(birthDate: Date | null | undefined): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

export default async function EditTecnicoPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor()
  const { id } = await params
  // Ticket.assignedToId references User.id (not Technician.id) — look up linked user first
  const linkedUser = await prisma.user.findUnique({ where: { technicianId: id }, select: { id: true } })

  const [tech, assignmentStats, ticketStats] = await Promise.all([
    getTechnician(actor, id),
    // Count assignments via AssignmentAssignee (technicianId = Technician.id ✓)
    prisma.assignmentAssignee.findMany({
      where: { technicianId: id, assignment: { tenantId: actor.tenantId } },
      include: { assignment: { select: { status: true } } },
    }).then((rows) => {
      if (!rows.length) return { total: 0, scheduled: 0, in_progress: 0, done: 0, cancelled: 0 }
      const byStatus: Record<string, number> = {}
      for (const r of rows) {
        const s = r.assignment.status
        byStatus[s] = (byStatus[s] ?? 0) + 1
      }
      return {
        total: rows.length,
        scheduled: byStatus['scheduled'] ?? 0,
        in_progress: byStatus['in_progress'] ?? 0,
        done: byStatus['done'] ?? 0,
        cancelled: byStatus['cancelled'] ?? 0,
      }
    }),
    // Tickets assigned via User account (assignedToId = User.id, not Technician.id)
    linkedUser
      ? prisma.ticket.groupBy({
          by: ['status'],
          where: { assignedToId: linkedUser.id, tenantId: actor.tenantId },
          _count: { id: true },
        }).then((rows) => {
          const byStatus = Object.fromEntries(rows.map(r => [r.status, r._count.id]))
          const total = rows.reduce((s, r) => s + r._count.id, 0)
          return { total, byStatus }
        })
      : Promise.resolve({ total: 0, byStatus: {} as Record<string, number> }),
  ])
  if (!tech) notFound()

  const [recentTickets, upcomingAssignments] = await Promise.all([
    linkedUser
      ? prisma.ticket.findMany({
          where: { assignedToId: linkedUser.id, tenantId: actor.tenantId },
          select: {
            id: true, ticketCode: true, title: true, status: true, urgency: true, createdAt: true,
            client: { select: { name: true } },
            branch: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : Promise.resolve([]),
    prisma.assignmentAssignee.findMany({
      where: {
        technicianId: tech.id,
        assignment: {
          tenantId: actor.tenantId,
          status: { in: ['scheduled', 'in_progress'] },
          start: { gte: new Date() },
        },
      },
      include: {
        assignment: {
          select: {
            id: true, title: true, status: true, start: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { assignment: { start: 'asc' } },
      take: 3,
    }),
  ])

  const contractType = (tech.contractType ?? 'indefinido') as ContractTypeId
  const contractDays = daysUntil(tech.contractEndDate)
  const contractExpired = contractDays != null && contractDays < 0
  const contractWarn = contractDays != null && contractDays >= 0 && contractDays <= 30
  const age = calcAge(tech.birthDate)

  const header = (
    <>
      <Link href="/recursos/tecnicos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Técnicos
      </Link>

      {/* Header card */}
      <div className="mt-3 mb-6 flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ${CONTRACT_TYPE_BADGE[contractType]}`}>
          {tech.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-ink">{tech.name}</h1>
          <p className="text-sm text-gray-500">{tech.specialty ?? 'Sin especialidad'}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTRACT_TYPE_BADGE[contractType]}`}>
              {CONTRACT_TYPE_LABELS[contractType]}
            </span>
            {age != null && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                {age} años{tech.birthDate ? ` · nació ${formatDate(tech.birthDate)}` : ''}
              </span>
            )}
            {(contractExpired || contractWarn) && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${contractExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {contractExpired
                  ? `Contrato vencido ${formatDate(tech.contractEndDate)}`
                  : `Contrato vence en ${contractDays}d (${formatDate(tech.contractEndDate)})`}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )

  const resumen = (
    <>
      {/* Estadísticas — linked */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Trabajos asignados',
            value: assignmentStats.total,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            href: `/cronograma?tecnico=${tech.id}`,
          },
          {
            label: 'En agenda',
            value: assignmentStats.scheduled + assignmentStats.in_progress,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            href: `/cronograma?tecnico=${tech.id}`,
          },
          {
            label: 'Completados',
            value: assignmentStats.done,
            color: 'text-green-600',
            bg: 'bg-green-50',
            href: `/cronograma?tecnico=${tech.id}`,
          },
          {
            label: 'Tickets asignados',
            value: ticketStats.total,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            href: linkedUser ? `/tickets?usuario=${linkedUser.id}` : '/tickets',
          },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`group rounded-xl border border-gray-200 ${stat.bg} p-3 text-center transition hover:shadow-md hover:scale-[1.02]`}
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="mt-0.5 text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
              {stat.label} <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
            </p>
          </Link>
        ))}
      </div>

      {/* Tickets recientes */}
      {recentTickets.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Tickets recientes</h2>
            {linkedUser && (
              <Link
                href={`/tickets?usuario=${linkedUser.id}`}
                className="inline-flex min-h-11 items-center text-xs font-medium text-brand-700 hover:underline"
              >
                Ver todos →
              </Link>
            )}
          </div>
          <ul className="divide-y divide-gray-100">
            {recentTickets.map(t => (
              <li key={t.id}>
                <Link
                  href={`/tickets/${t.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:bg-gray-50 -mx-1 px-1 rounded transition"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{t.title}</p>
                    <p className="text-xs text-gray-500">
                      {t.client.name}{t.branch ? ` · ${t.branch.name}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status as TicketStatusId] ?? 'bg-gray-300'}`} />
                    {STATUS_LABEL[t.status as TicketStatusId] ?? t.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Próximas asignaciones */}
      {upcomingAssignments.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Próximas asignaciones</h2>
            <Link
              href={`/cronograma?tecnico=${tech.id}`}
              className="inline-flex min-h-11 items-center text-xs font-medium text-brand-700 hover:underline"
            >
              Ver cronograma →
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {upcomingAssignments.map((row) => (
              <li key={row.assignment.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{row.assignment.title}</p>
                  <p className="text-xs text-gray-500">{row.assignment.client?.name ?? '—'}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-gray-500 whitespace-nowrap">
                  {new Date(row.assignment.start).toLocaleDateString('es-CL', {
                    day: 'numeric', month: 'short',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Desglose tickets por estado */}
      {ticketStats.total > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink">Tickets por estado</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ticketStats.byStatus).map(([status, count]) => (
              <span key={status} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                {status.replace(/_/g, ' ')} · <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )

  const datos = (
    <TechnicianForm action={updateTechnician.bind(null, tech.id)} initial={tech} submitLabel="Guardar cambios" />
  )

  const vehiculo = (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Camioneta e inventario
          {tech.vehicle && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{tech.vehicle.plate}</span>}
        </h2>
        {tech.vehicle ? (
          <Link href={`/recursos/vehiculos/${tech.vehicle.id}`} className="text-xs text-brand-600 hover:underline">
            Ver camioneta
          </Link>
        ) : (
          <Link href="/recursos/vehiculos/new" className="text-xs text-brand-600 hover:underline">
            + Asignar camioneta
          </Link>
        )}
      </div>
      {!tech.vehicle ? (
        <p className="text-xs text-gray-400">
          Este técnico no tiene camioneta. En <strong>Vehículos</strong>, crea o edita una y asígnasela.
        </p>
      ) : tech.vehicle.assets.length === 0 ? (
        <p className="text-xs text-gray-400">
          La camioneta {tech.vehicle.plate} no tiene herramientas. En <strong>Maquinaria / activos</strong>, asígnalas.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 text-sm">
          {tech.vehicle.assets.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span className="text-ink">
                {a.name}
                {a.code && <span className="ml-2 text-xs text-gray-400">{a.code}</span>}
              </span>
              <span className="text-xs text-gray-500">{ASSET_STATUS_LABELS[a.status as AssetStatusId]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const documentos = (
    <DocSection
      technicianId={tech.id}
      initial={(tech.documents ?? []).map((d) => ({
        ...d,
        expiryDate: d.expiryDate ?? null,
      }))}
    />
  )

  return (
    <TechnicianProfileShell
      header={header}
      resumen={resumen}
      datos={datos}
      vehiculo={vehiculo}
      documentos={documentos}
      hasVehicle={!!tech.vehicle}
    />
  )
}
