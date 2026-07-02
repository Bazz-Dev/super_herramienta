import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'

export const metadata = { title: 'Inicio — INGEGAR' }

const APP_VERSION = 'v1.8.0'

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
    title: 'Módulo Clientes — contadores cross-módulo',
    desc: 'Perfil de cliente con contadores de trabajos, sucursales, cronograma y tickets. Panel de actividad reciente.',
  },
  {
    date: 'Jun 2026',
    type: 'nuevo' as const,
    title: 'Portal cliente — PWA + notificaciones push',
    desc: 'Instalable en iPhone y Android. Notificaciones push cuando cambia el estado de un ticket.',
  },
  {
    date: 'Próximo',
    type: 'pronto' as const,
    title: 'Pipeline comercial',
    desc: 'Seguimiento de cotizaciones enviadas, estados y alertas de seguimiento.',
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
  const now = Date.now()
  for (const v of vehicles) {
    const checks = [
      { label: 'Rev. técnica', d: v.revTecnicaExpiry },
      { label: 'SOAP', d: v.soapExpiry },
      { label: 'Permiso circ.', d: v.permisoCirculacionExpiry },
      { label: 'Mantención', d: v.nextServiceDate },
    ]
    for (const { label, d } of checks) {
      if (!d) continue
      const days = Math.ceil((new Date(d).getTime() - now) / 86400000)
      if (days <= 30) alerts.push({ vehicleId: v.id, plate: v.plate, label, days })
    }
  }
  return alerts.sort((a, b) => a.days - b.days)
}

export default async function DashboardPage() {
  const session = await auth()
  const user = session!.user
  const actor = { id: user.id, tenantId: user.tenantId, role: user.role }
  const firstName = (user.name ?? 'Usuario').split(' ')[0]
  const scope = tenantScope(actor)

  const [technicians, vehicles, openTickets, cashflow, expenseStats] = await Promise.all([
    prisma.technician.findMany({
      where: { ...scope, active: true },
      select: { id: true, name: true },
    }),
    prisma.vehicle.findMany({
      where: scope,
      select: { id: true, plate: true, revTecnicaExpiry: true, soapExpiry: true, permisoCirculacionExpiry: true, nextServiceDate: true, technicianId: true, status: true },
    }),
    prisma.ticket.findMany({
      where: { ...scope, status: { notIn: ['resuelto', 'cancelado', 'fusionado'] } },
      select: { id: true, status: true, urgency: true, assignedToId: true, client: { select: { name: true } } },
    }),
    prisma.job.aggregate({
      where: { ...scope, collectionStatus: { in: ['pendiente_pago', 'sin_oc'] } },
      _sum: { netAmount: true },
    }),
    Promise.all([
      prisma.expense.aggregate({
        where: { ...scope, status: 'pendiente' },
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { ...scope, status: 'aprobado' },
        _sum: { amount: true },
      }),
    ]),
  ])

  const vehicleAlerts = expiryAlerts(vehicles)
  const unassigned = openTickets.filter(t => !t.assignedToId)
  const emergencias = openTickets.filter(t => t.urgency === 'emergencia')
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const vehiclesOk = vehicles.filter(v => {
    const checks = [v.revTecnicaExpiry, v.soapExpiry, v.permisoCirculacionExpiry, v.nextServiceDate]
    return checks.every(d => !d || Math.ceil((new Date(d).getTime() - nowMs) / 86400000) > 30)
  })
  const pendingCLP = cashflow._sum.netAmount ?? 0
  const [pendingExpenses, approvedExpenses] = expenseStats
  const pendingExpenseCount = pendingExpenses._count.id
  const pendingExpenseAmount = pendingExpenses._sum.amount ?? 0
  const approvedExpenseAmount = approvedExpenses._sum.amount ?? 0

  const vehicleAssigned = vehicles.filter(v => v.technicianId).length

  const hour = new Date().getHours()
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink">{greeting}, {firstName}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-mono font-semibold text-gray-400 shadow-sm self-center">
          INGEGAR Platform {APP_VERSION}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <Link href="/recursos/tecnicos" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Técnicos activos</p>
          <p className="mt-2 text-3xl font-bold text-ink">{technicians.length}</p>
          <p className="mt-1 text-xs text-gray-500">{vehicleAssigned} con camioneta</p>
        </Link>

        <Link href="/recursos/vehiculos" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Vehículos</p>
          <p className="mt-2 text-3xl font-bold text-ink">{vehicles.length}</p>
          <p className={`mt-1 text-xs font-medium ${vehicleAlerts.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {vehicleAlerts.length > 0 ? `${vehicleAlerts.length} alerta${vehicleAlerts.length > 1 ? 's' : ''}` : `${vehiclesOk.length} OK`}
          </p>
        </Link>

        <Link href="/tickets" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Tickets abiertos</p>
          <p className="mt-2 text-3xl font-bold text-ink">{openTickets.length}</p>
          <p className={`mt-1 text-xs font-medium ${unassigned.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {unassigned.length > 0 ? `${unassigned.length} sin asignar` : 'Todos asignados'}
            {emergencias.length > 0 && <span className="ml-1 text-red-700">· {emergencias.length} urg.</span>}
          </p>
        </Link>

        <Link href="/flujo" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Por cobrar</p>
          <p className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">
            {pendingCLP > 0 ? `$${(pendingCLP / 1_000_000).toFixed(1)}M` : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Flujo pendiente</p>
        </Link>

        <Link href="/gastos" className={`group rounded-xl border p-4 shadow-sm transition hover:shadow-md ${pendingExpenseCount > 0 ? 'border-amber-300 bg-amber-50 hover:border-amber-400' : 'border-gray-200 bg-white hover:border-brand'}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Gastos pendientes</p>
          <p className={`mt-2 text-3xl font-bold ${pendingExpenseCount > 0 ? 'text-amber-700' : 'text-ink'}`}>{pendingExpenseCount}</p>
          <p className="mt-1 text-xs text-gray-500">
            {pendingExpenseAmount > 0 ? `$${(pendingExpenseAmount / 1000).toFixed(0)}K por aprobar` : 'Sin pendientes'}
          </p>
        </Link>

        <Link href="/gastos" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Gastos aprobados</p>
          <p className="mt-2 text-2xl font-bold text-green-700 tabular-nums">
            {approvedExpenseAmount > 0 ? `$${(approvedExpenseAmount / 1_000_000).toFixed(1)}M` : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Mes en curso</p>
        </Link>
      </div>

      {/* Alerts + Quick access */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vehicle alerts */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Alertas de vehículos</h2>
            <Link href="/recursos/vehiculos" className="text-xs text-brand-700 hover:underline font-medium">Ver todos →</Link>
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
            <Link href="/tickets" className="text-xs text-brand-700 hover:underline font-medium">Ver todos →</Link>
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
