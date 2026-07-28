import Link from 'next/link'
import { Suspense } from 'react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { listJobs } from '@/lib/cashflow/queries'
import { computeMetrics, type JobLike } from '@/lib/cashflow/metrics'
import { isNoPOJob, isOverdueV2 } from '@/lib/cashflow/job-presets'
import { periodRange, pctDelta } from '@/lib/cashflow/period'
import { clp } from '@/lib/cashflow/format'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { PeriodFilter } from '@/components/cashflow/period-filter'
import { DOC_TYPE_LABELS, type DocTypeId } from '@/lib/resources/labels'
import { LEAVE_TYPE_LABEL } from '@/lib/rrhh/labels'

export const metadata = { title: 'Inicio — INGEGAR' }

const APP_VERSION = 'v1.11.0'

// ── Información institucional INGEGAR ─────────────────────────────────────────
const EMPRESA = {
  razonSocial: 'INGEGAR SpA',
  rut: '77.123.456-7',           // ← actualizar con RUT real
  giro: 'Mantención y climatización industrial',
  mutualidad: 'ACHS',            // Asociación Chilena de Seguridad
  codigoMutual: 'ING-2024-001',  // ← actualizar con código real
  direccion: 'Santiago, Chile',
  telefono: '+56 2 2222 2222',   // ← actualizar
  email: 'admin@ingegarchile.cl',
  web: 'www.ingegarchile.cl',
  regimenTributario: 'Primera Categoría — contabilidad completa',
  afp: 'Capital',                // AFP del personal (referencial)
  prevision: 'FONASA',           // previsión de salud predominante
}

const NOVEDADES = [
  {
    date: 'Jul 2026',
    type: 'nuevo' as const,
    title: 'Dashboard enfocado en atención, no en vitrina',
    desc: 'Rediseño: "¿qué requiere mi atención ahora?" — facturas vencidas, trabajos sin OC, documentos por vencer y permisos pendientes al frente, en vez de KPIs decorativos.',
  },
  {
    date: 'Jun 2026',
    type: 'nuevo' as const,
    title: 'Almacenamiento R2 + documentos con acceso seguro',
    desc: 'Archivos en Cloudflare R2 con signed URLs (1 h). Documentos de técnicos y tickets sin URLs públicas.',
  },
  {
    date: 'Jun 2026',
    type: 'nuevo' as const,
    title: 'Módulo Gastos — operacionales y rendición técnicos',
    desc: 'Registro de gastos por técnico con comprobante, aprobación supervisor y vinculación a ticket o trabajo.',
  },
  {
    date: 'Jun 2026',
    type: 'nuevo' as const,
    title: 'Portal cliente — PWA + notificaciones push',
    desc: 'Instalable en iPhone y Android. Notificaciones push cuando cambia el estado de un ticket.',
  },
]

const TYPE_BADGE = {
  nuevo:  'bg-green-100 text-green-700',
  mejora: 'bg-brand/15 text-amber-700',
  pronto: 'bg-gray-100 text-gray-500',
}
const TYPE_LABEL = { nuevo: 'Nuevo', mejora: 'Mejora', pronto: 'Próximamente' }

function expiryAlerts(vehicles: { plate: string; id: string; revTecnicaExpiry: Date | null; soapExpiry: Date | null; permisoCirculacionExpiry: Date | null; nextServiceDate: Date | null }[]) {
  const alerts: { vehicleId: string; plate: string; label: string; days: number }[] = []
  const nowMs = Date.now()
  for (const v of vehicles) {
    const checks = [
      { label: 'Rev. técnica', d: v.revTecnicaExpiry },
      { label: 'SOAP', d: v.soapExpiry },
      { label: 'Permiso circ.', d: v.permisoCirculacionExpiry },
      { label: 'Mantención', d: v.nextServiceDate },
    ]
    for (const { label, d } of checks) {
      if (!d) continue
      const days = Math.ceil((new Date(d).getTime() - nowMs) / 86400000)
      if (days <= 30) alerts.push({ vehicleId: v.id, plate: v.plate, label, days })
    }
  }
  return alerts.sort((a, b) => a.days - b.days)
}

// Mismo umbral (30 días) que doc-section.tsx (expiryStatus) usa para la
// ficha de técnico — no se inventa un criterio nuevo para el dashboard.
function technicianDocAlerts(docs: { type: string; label: string | null; expiryDate: Date | null; technician: { id: string; name: string } }[]) {
  const alerts: { techId: string; techName: string; label: string; days: number }[] = []
  const nowMs = Date.now()
  for (const d of docs) {
    if (!d.expiryDate) continue
    const days = Math.ceil((new Date(d.expiryDate).getTime() - nowMs) / 86400000)
    if (days <= 30) {
      alerts.push({
        techId: d.technician.id,
        techName: d.technician.name,
        label: d.label ?? DOC_TYPE_LABELS[d.type as DocTypeId] ?? d.type,
        days,
      })
    }
  }
  return alerts.sort((a, b) => a.days - b.days)
}

type AttentionTone = 'danger' | 'warn' | 'brand'

const ATTENTION_TONE: Record<AttentionTone, string> = {
  danger: 'border-red-200 bg-red-50 hover:border-red-300',
  warn:   'border-amber-200 bg-amber-50 hover:border-amber-300',
  brand:  'border-gray-200 bg-white hover:border-brand',
}
const ATTENTION_VALUE_TONE: Record<AttentionTone, string> = {
  danger: 'text-red-700',
  warn:   'text-amber-700',
  brand:  'text-ink',
}

function AttentionCard({ href, label, value, sub, tone }: { href: string; label: string; value: string; sub?: string; tone: AttentionTone }) {
  return (
    <Link href={href} className={`group rounded-xl border p-4 shadow-sm transition hover:shadow-md ${ATTENTION_TONE[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tabular-nums ${ATTENTION_VALUE_TONE[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </Link>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>
}) {
  const session = await auth()
  const user = session!.user
  const actor = { id: user.id, tenantId: user.tenantId, role: user.role }
  const firstName = (user.name ?? 'Usuario').split(' ')[0]
  const scope = tenantScope(actor)
  const { periodo } = await searchParams
  const { from, to, prevFrom, prevTo, deltaLabel } = periodRange(periodo)

  const [
    technicians, vehicles, openTickets, cashflow, expenseStats, periodJobs, prevPeriodJobs,
    resolvedCount, prevResolvedCount, attentionJobs, technicianDocs, pendingLeaveRequests,
  ] = await Promise.all([
    prisma.technician.findMany({
      where: { ...scope, active: true },
      select: { id: true, name: true, vehicle: { select: { id: true } } },
    }),
    prisma.vehicle.findMany({
      where: scope,
      select: { id: true, plate: true, revTecnicaExpiry: true, soapExpiry: true, permisoCirculacionExpiry: true, nextServiceDate: true, technicianId: true, status: true },
    }),
    prisma.ticket.findMany({
      where: { ...scope, status: { notIn: ['resuelto', 'cancelado', 'fusionado'] } },
      select: { id: true, status: true, urgency: true, assignedToId: true, client: { select: { name: true } }, assignedTo: { select: { name: true } } },
    }),
    prisma.job.aggregate({
      where: { ...scope, collectionStatus: { in: ['pendiente_pago', 'sin_oc'] } },
      _sum: { netAmount: true },
    }),
    prisma.expense.aggregate({
      where: { ...scope, status: 'pendiente' },
      _count: { id: true },
      _sum: { amount: true },
    }),
    // Resumen del período: facturación + tickets resueltos, comparados contra
    // el período anterior equivalente — no aplica a "total" (from undefined).
    from ? listJobs(actor, { from, to }) : Promise.resolve([]),
    from ? listJobs(actor, { from: prevFrom, to: prevTo }) : Promise.resolve([]),
    from ? prisma.ticket.count({ where: { ...scope, status: 'resuelto', updatedAt: { gte: from, lte: to } } }) : Promise.resolve(0),
    from ? prisma.ticket.count({ where: { ...scope, status: 'resuelto', updatedAt: { gte: prevFrom, lte: prevTo } } }) : Promise.resolve(0),
    // "Requiere tu atención" — reusa exactamente los predicados de
    // src/lib/cashflow/job-presets.ts (isNoPOJob/isOverdueV2), no reimplementa
    // las reglas de negocio. Sin filtro de período: es el backlog real completo,
    // no una foto del mes.
    prisma.job.findMany({
      where: scope,
      select: {
        financialStage: true, commercialStage: true, operationalStage: true, nonBillable: true,
        netAmount: true, purchaseOrder: true, invoiceNumber: true, invoiceDate: true,
        paymentDate: true, executionDate: true, creditDays: true,
      },
    }),
    prisma.technicianDocument.findMany({
      where: { technician: { ...scope, active: true }, expiryDate: { not: null } },
      select: { type: true, label: true, expiryDate: true, technician: { select: { id: true, name: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: { ...scope, status: 'pendiente' },
      select: { id: true, type: true, startDate: true, technician: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const periodMetrics = from ? computeMetrics(periodJobs as unknown as JobLike[], to ?? new Date()) : null
  const prevPeriodMetrics = from ? computeMetrics(prevPeriodJobs as unknown as JobLike[], prevTo ?? new Date()) : null
  const facturadoDeltaPct = periodMetrics && prevPeriodMetrics ? pctDelta(periodMetrics.facturado, prevPeriodMetrics.facturado) : null
  const resolvedDeltaPct = from ? pctDelta(resolvedCount, prevResolvedCount) : null

  // Tickets activos por técnico — misma convención tabla+barra que
  // computeMonthlyTrend/MonthlyTrend en cashflow (sin librería de gráficos).
  const workloadMap = new Map<string, number>()
  for (const t of openTickets) {
    if (!t.assignedTo) continue
    workloadMap.set(t.assignedTo.name, (workloadMap.get(t.assignedTo.name) ?? 0) + 1)
  }
  const techWorkload = [...workloadMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  const maxTechCount = techWorkload[0]?.count ?? 1

  const vehicleAlerts = expiryAlerts(vehicles)
  const techDocAlerts = technicianDocAlerts(technicianDocs)
  const unassigned = openTickets.filter(t => !t.assignedToId)
  const emergencias = openTickets.filter(t => t.urgency === 'emergencia')
  const now = new Date()

  const overdueJobs = attentionJobs.filter(j => isOverdueV2(j, now))
  const overdueAmount = overdueJobs.reduce((s, j) => s + (j.netAmount ?? 0), 0)
  const noPOJobs = attentionJobs.filter(isNoPOJob)

  const pendingCLP = cashflow._sum.netAmount ?? 0
  const pendingExpenseCount = expenseStats._count.id
  const pendingExpenseAmount = expenseStats._sum.amount ?? 0

  const vehicleAssigned = technicians.filter(t => t.vehicle).length

  const hour = now.getHours()
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'

  // "¿Qué requiere mi atención ahora?" — solo excepciones reales (count > 0),
  // nunca tarjetas en cero: una tarjeta "0 facturas vencidas" no es una alerta,
  // es ruido. Orden = urgencia (vencido > por vencer > pendiente > informativo).
  const attentionCards: { id: string; href: string; label: string; value: string; sub?: string; tone: AttentionTone }[] = []
  if (overdueJobs.length > 0) {
    attentionCards.push({ id: 'overdue', href: '/flujo?estado=overdue', label: 'Facturas vencidas', value: String(overdueJobs.length), sub: clp(overdueAmount), tone: 'danger' })
  }
  if (vehicleAlerts.length > 0) {
    const expired = vehicleAlerts.filter(a => a.days < 0).length
    attentionCards.push({
      id: 'veh-docs', href: '/recursos/vehiculos', label: 'Vehículos: documentos por vencer',
      value: String(vehicleAlerts.length), sub: expired > 0 ? `${expired} vencido(s)` : 'Próximos a vencer (30d)',
      tone: expired > 0 ? 'danger' : 'warn',
    })
  }
  if (techDocAlerts.length > 0) {
    const expired = techDocAlerts.filter(a => a.days < 0).length
    attentionCards.push({
      id: 'tech-docs', href: '/recursos/tecnicos', label: 'Técnicos: documentos por vencer',
      value: String(techDocAlerts.length), sub: expired > 0 ? `${expired} vencido(s)` : 'Próximos a vencer (30d)',
      tone: expired > 0 ? 'danger' : 'warn',
    })
  }
  if (noPOJobs.length > 0) {
    attentionCards.push({ id: 'no-po', href: '/flujo?estado=no_po', label: 'Trabajos ejecutados sin OC', value: String(noPOJobs.length), tone: 'warn' })
  }
  if (unassigned.length > 0) {
    attentionCards.push({
      id: 'tickets', href: '/tickets', label: 'Tickets sin asignar', value: String(unassigned.length),
      sub: emergencias.length > 0 ? `${emergencias.length} emergencia(s)` : undefined,
      tone: emergencias.length > 0 ? 'danger' : 'warn',
    })
  }
  if (pendingLeaveRequests.length > 0) {
    attentionCards.push({ id: 'permisos', href: '/rrhh/vacaciones', label: 'Permisos pendientes', value: String(pendingLeaveRequests.length), tone: 'warn' })
  }
  if (pendingExpenseCount > 0) {
    attentionCards.push({
      id: 'gastos', href: '/gastos', label: 'Gastos pendientes de aprobar', value: String(pendingExpenseCount),
      sub: pendingExpenseAmount > 0 ? clp(pendingExpenseAmount) : undefined, tone: 'warn',
    })
  }
  if (pendingCLP > 0) {
    attentionCards.push({ id: 'por-cobrar', href: '/flujo', label: 'Cuentas por cobrar', value: clp(pendingCLP), tone: 'brand' })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">{greeting}, {firstName}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            <Link href="/recursos/tecnicos" className="hover:text-gray-600 hover:underline">{technicians.length} técnicos activos</Link>
            {' · '}
            <Link href="/recursos/vehiculos" className="hover:text-gray-600 hover:underline">{vehicles.length} vehículos</Link>
            {' · '}
            <Link href="/tickets" className="hover:text-gray-600 hover:underline">{openTickets.length} tickets abiertos</Link>
            {vehicleAssigned > 0 && <span className="text-gray-300"> ({vehicleAssigned} técnicos con camioneta)</span>}
          </p>
        </div>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-mono font-semibold text-gray-400 shadow-sm self-center">
          INGEGAR Platform {APP_VERSION}
        </span>
      </div>

      {/* Requiere tu atención — el corazón del dashboard: solo excepciones
          reales, ordenadas por urgencia. Reemplaza la fila de KPIs decorativos
          (técnicos activos, gastos aprobados del mes, etc.) que no le decían
          al dueño qué hacer hoy. */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Requiere tu atención</h2>
        {attentionCards.length === 0 ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-green-700">Todo al día</p>
            <p className="mt-1 text-xs text-green-600">Sin facturas vencidas, documentos por vencer, tickets sin asignar ni permisos pendientes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {attentionCards.map(c => <AttentionCard key={c.id} {...c} />)}
          </div>
        )}
      </div>

      {/* Resumen del período — no es una foto fija: compara contra el
          período anterior equivalente para dar una historia con los datos,
          no solo un número suelto. */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Resumen del período</h2>
          <Suspense fallback={null}><PeriodFilter basePath="/dashboard" active={periodo} /></Suspense>
        </div>
        {periodMetrics ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Facturado"
              value={clp(periodMetrics.facturado)}
              delta={facturadoDeltaPct != null ? { pct: facturadoDeltaPct, label: deltaLabel } : undefined}
            />
            <KpiCard
              label="Tickets resueltos"
              value={String(resolvedCount)}
              delta={resolvedDeltaPct != null ? { pct: resolvedDeltaPct, label: deltaLabel } : undefined}
            />
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Tickets activos por técnico</p>
              {techWorkload.length === 0 ? (
                <p className="text-xs text-gray-400">Sin tickets activos asignados.</p>
              ) : (
                <ul className="space-y-1.5">
                  {techWorkload.slice(0, 5).map((t) => (
                    <li key={t.name} className="flex items-center gap-2 text-xs">
                      <span className="w-20 shrink-0 truncate text-gray-600">{t.name}</span>
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-brand" style={{ width: `${(t.count / maxTechCount) * 100}%` }} />
                      </div>
                      <span className="w-4 shrink-0 text-right font-semibold text-ink">{t.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Elige un período específico (no &quot;Todo&quot;) para ver facturación y tickets resueltos comparados contra el período anterior.</p>
        )}
      </div>

      {/* Detalle de las excepciones — mismos datos de "Requiere tu atención"
          pero con el ítem concreto para actuar directo desde acá. */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vehicle alerts */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Alertas de vehículos</h2>
            <Link href="/recursos/vehiculos" className="inline-flex min-h-11 items-center text-xs text-brand-700 hover:underline font-medium">Ver todos →</Link>
          </div>
          {vehicleAlerts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Sin alertas. Todos los documentos al día.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {vehicleAlerts.slice(0, 6).map((a, i) => (
                <li key={i}>
                  <Link href={`/recursos/vehiculos/${a.vehicleId}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                    <div>
                      <span className="text-sm font-semibold text-ink">{a.plate}</span>
                      <span className="ml-2 text-xs text-gray-500">{a.label}</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.days < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.days < 0 ? `Vencido ${Math.abs(a.days)}d` : `${a.days}d`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tickets sin asignar */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Tickets sin asignar</h2>
            <Link href="/tickets" className="inline-flex min-h-11 items-center text-xs text-brand-700 hover:underline font-medium">Ver todos →</Link>
          </div>
          {unassigned.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Todos los tickets tienen técnico asignado.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {unassigned.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link href={`/tickets/${t.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                    <div>
                      <span className="text-sm font-medium text-ink">{t.client.name}</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${t.urgency === 'emergencia' ? 'bg-red-100 text-red-700' : t.urgency === 'urgencia' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.urgency}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Documentos de técnicos */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Documentos de técnicos</h2>
            <Link href="/recursos/tecnicos" className="inline-flex min-h-11 items-center text-xs text-brand-700 hover:underline font-medium">Ver todos →</Link>
          </div>
          {techDocAlerts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Sin alertas. Documentación al día.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {techDocAlerts.slice(0, 6).map((a, i) => (
                <li key={i}>
                  <Link href={`/recursos/tecnicos/${a.techId}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                    <div>
                      <span className="text-sm font-semibold text-ink">{a.techName}</span>
                      <span className="ml-2 text-xs text-gray-500">{a.label}</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.days < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.days < 0 ? `Vencido ${Math.abs(a.days)}d` : `${a.days}d`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Permisos pendientes */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Permisos pendientes</h2>
            <Link href="/rrhh/vacaciones" className="inline-flex min-h-11 items-center text-xs text-brand-700 hover:underline font-medium">Ver todos →</Link>
          </div>
          {pendingLeaveRequests.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">Sin solicitudes pendientes.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {pendingLeaveRequests.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <Link href="/rrhh/vacaciones" className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                    <div>
                      <span className="text-sm font-semibold text-ink">{l.technician.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{LEAVE_TYPE_LABEL[l.type] ?? l.type}</span>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      {new Date(l.startDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Información INGEGAR */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Información de la empresa</h2>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Datos legales */}
            <div className="p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Datos legales</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Razón social</dt>
                  <dd className="font-semibold text-ink text-right">{EMPRESA.razonSocial}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">RUT</dt>
                  <dd className="font-mono font-semibold text-brand">{EMPRESA.rut}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Giro</dt>
                  <dd className="text-gray-700 text-right text-xs">{EMPRESA.giro}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Régimen tributario</dt>
                  <dd className="text-gray-700 text-right text-xs">{EMPRESA.regimenTributario}</dd>
                </div>
              </dl>
            </div>

            {/* Mutual y previsión */}
            <div className="p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Mutual y previsión</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Mutualidad</dt>
                  <dd className="font-semibold text-ink">{EMPRESA.mutualidad}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Código empresa</dt>
                  <dd className="font-mono text-gray-700">{EMPRESA.codigoMutual}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">AFP</dt>
                  <dd className="text-gray-700">{EMPRESA.afp}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Previsión salud</dt>
                  <dd className="text-gray-700">{EMPRESA.prevision}</dd>
                </div>
              </dl>
            </div>

            {/* Contacto */}
            <div className="p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Contacto</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Dirección</dt>
                  <dd className="text-gray-700">{EMPRESA.direccion}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Teléfono</dt>
                  <dd className="font-mono text-gray-700">{EMPRESA.telefono}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="text-blue-600 text-xs">{EMPRESA.email}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Web</dt>
                  <dd className="text-gray-700">{EMPRESA.web}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Novedades */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Novedades y hoja de ruta</h2>
        <div className="space-y-2">
          {NOVEDADES.map((n, i) => (
            <div key={i} className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${TYPE_BADGE[n.type]}`}>
                {TYPE_LABEL[n.type]}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{n.title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{n.desc}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs text-gray-400">{n.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
