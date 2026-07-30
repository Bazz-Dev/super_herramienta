import Link from 'next/link'
import { Suspense } from 'react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { listJobs } from '@/lib/cashflow/queries'
import { computeMetrics, type JobLike } from '@/lib/cashflow/metrics'
import { isNoPOJob, isOverdueV2 } from '@/lib/cashflow/job-presets'
import { dateRange, pctDelta } from '@/lib/cashflow/period'
import { clp } from '@/lib/cashflow/format'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { DateRangeFilter } from '@/components/cashflow/date-range-filter'
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

// tone se mapea directo a los tonos de KpiCard (mismo lenguaje visual que
// /flujo — antes esta página tenía su propia tarjeta con fondo pastel
// completo en vez de reusar el mismo componente.
type AttentionTone = 'danger' | 'warn' | 'default'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  const session = await auth()
  const user = session!.user
  const actor = { id: user.id, tenantId: user.tenantId, role: user.role }
  const firstName = (user.name ?? 'Usuario').split(' ')[0]
  const scope = tenantScope(actor)
  const { desde, hasta } = await searchParams
  const { from, to, prevFrom, prevTo, deltaLabel } = dateRange(desde, hasta)

  const [
    technicians, vehicles, openTickets, cashflow, expenseStats, periodJobs, prevPeriodJobs,
    resolvedCount, prevResolvedCount, attentionJobs, technicianDocs, pendingLeaveRequests,
  ] = await Promise.all([
    prisma.technician.findMany({
      where: { ...scope, active: true },
      select: { id: true, name: true, specialty: true, vehicle: { select: { id: true } } },
    }),
    prisma.vehicle.findMany({
      where: scope,
      select: { id: true, plate: true, revTecnicaExpiry: true, soapExpiry: true, permisoCirculacionExpiry: true, nextServiceDate: true, technicianId: true, status: true },
    }),
    prisma.ticket.findMany({
      where: { ...scope, status: { notIn: ['resuelto', 'cancelado', 'fusionado'] } },
      // assignedTo.technicianId: Ticket.assignedToId apunta a User, no a
      // Technician (ver .claude/rules/data.md) — puede ser un supervisor
      // autoasignado, no siempre un técnico real. Se resuelve el link a la
      // ficha (y la especialidad) solo cuando technicianId existe.
      select: { id: true, status: true, urgency: true, estimatedDate: true, assignedToId: true, client: { select: { name: true } }, assignedTo: { select: { name: true, technicianId: true } } },
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
        // Respaldo para trabajos importados con las etapas v2 sin poblar —
        // ver el comentario en job-presets.ts.
        status: true, collectionStatus: true,
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

  const now = new Date()

  // Tickets activos por técnico — antes agrupaba por assignedTo.name (string):
  // dos personas con el mismo nombre real habrían colisionado en la misma
  // fila. Agrupa por assignedToId (User.id, el dato real y único) — el
  // asignado puede ser un supervisor autoasignado, no siempre un técnico,
  // así que el link a la ficha y la especialidad solo se resuelven cuando
  // hay un Technician real detrás (assignedTo.technicianId).
  const specialtyByTechId = new Map(technicians.map((t) => [t.id, t.specialty]))
  const workloadMap = new Map<string, { name: string; technicianId: string | null; count: number; overdue: number }>()
  for (const t of openTickets) {
    if (!t.assignedToId || !t.assignedTo) continue
    const entry = workloadMap.get(t.assignedToId) ?? { name: t.assignedTo.name, technicianId: t.assignedTo.technicianId, count: 0, overdue: 0 }
    entry.count++
    if (t.estimatedDate && new Date(t.estimatedDate).getTime() < now.getTime()) entry.overdue++
    workloadMap.set(t.assignedToId, entry)
  }
  const techWorkload = [...workloadMap.entries()]
    .map(([userId, w]) => ({
      userId,
      technicianId: w.technicianId,
      name: w.name,
      specialty: w.technicianId ? specialtyByTechId.get(w.technicianId) : null,
      count: w.count,
      overdue: w.overdue,
    }))
    .sort((a, b) => b.count - a.count)

  const vehicleAlerts = expiryAlerts(vehicles)
  const techDocAlerts = technicianDocAlerts(technicianDocs)
  const unassigned = openTickets.filter(t => !t.assignedToId)
  const emergencias = openTickets.filter(t => t.urgency === 'emergencia')

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
    attentionCards.push({ id: 'por-cobrar', href: '/flujo', label: 'Cuentas por cobrar', value: clp(pendingCLP), tone: 'default' })
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
            {attentionCards.map(c => <KpiCard key={c.id} href={c.href} label={c.label} value={c.value} hint={c.sub} tone={c.tone} />)}
          </div>
        )}
      </div>

      {/* Resumen del período — no es una foto fija: compara contra el
          período anterior equivalente para dar una historia con los datos,
          no solo un número suelto. */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Resumen del período</h2>
          <Suspense fallback={null}><DateRangeFilter basePath="/dashboard" desde={desde} hasta={hasta} /></Suspense>
        </div>
        {periodMetrics ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>
        ) : (
          <p className="text-sm text-gray-400">Elige un período específico (no &quot;Todo&quot;) para ver facturación y tickets resueltos comparados contra el período anterior.</p>
        )}
      </div>

      {/* Carga por técnico — antes vivía adentro de "Resumen del período" como
          tabla+barra agrupada por nombre en texto, lo que (a) la escondía
          por completo si el filtro estaba en "Todo" pese a no depender del
          período, y (b) habría colisionado dos técnicos con el mismo
          nombre. Ahora es su propia sección siempre visible, con cards que
          reusan el lenguaje visual ya establecido en /recursos/tecnicos
          (avatar de iniciales + stat), agrupada por técnico real
          (assignedToId), con link directo a la ficha completa. */}
      {techWorkload.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Carga por técnico</h2>
            <span className="text-xs text-gray-400">{techWorkload.length} con tickets activos</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {techWorkload.map((t) => {
              const cardClass = `flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-shadow ${t.technicianId ? 'hover:shadow-md' : ''}`
              const cardBody = (
                <>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                    {t.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                    <p className="truncate text-xs text-gray-400">{t.specialty ?? (t.technicianId ? 'Sin especialidad' : 'Staff')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {t.overdue > 0 && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        {t.overdue} vencido{t.overdue > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="flex flex-col items-center rounded-md bg-gray-50 px-2 py-1">
                      <span className="text-sm font-bold text-ink">{t.count}</span>
                      <span className="text-[9px] uppercase tracking-wide text-gray-400">activos</span>
                    </span>
                  </div>
                </>
              )
              return t.technicianId ? (
                <Link key={t.userId} href={`/recursos/tecnicos/${t.technicianId}`} className={cardClass}>{cardBody}</Link>
              ) : (
                <div key={t.userId} className={cardClass}>{cardBody}</div>
              )
            })}
          </div>
        </div>
      )}

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
