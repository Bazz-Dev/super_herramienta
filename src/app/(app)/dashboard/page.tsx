import Link from 'next/link'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'

export const metadata = { title: 'Inicio — INGEGAR' }

const NOVEDADES = [
  {
    date: 'Jun 2026',
    type: 'nuevo' as const,
    title: 'Portal cliente multi-tenant',
    desc: 'Acceso SSO: staff entra al portal JB sin re-login. Sesiones de 30 días.',
  },
  {
    date: 'Jun 2026',
    type: 'nuevo' as const,
    title: 'Flujo de Caja con datos históricos',
    desc: '$74.8M registrados: Just Burger (205 trabajos), Decathlon, Unity.',
  },
  {
    date: 'Jun 2026',
    type: 'mejora' as const,
    title: 'Tickets — filtros corregidos y más datos',
    desc: 'Filtros por cliente y técnico funcionan correctamente. Kanban mejorado.',
  },
  {
    date: 'Próximo',
    type: 'pronto' as const,
    title: 'Notificaciones por rol',
    desc: 'Alertas de mantención de vehículos, tickets sin asignar y vencimientos.',
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

  const [technicians, vehicles, openTickets, cashflow] = await Promise.all([
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
  ])

  const vehicleAlerts = expiryAlerts(vehicles)
  const unassigned = openTickets.filter(t => !t.assignedToId)
  const emergencias = openTickets.filter(t => t.urgency === 'emergencia')
  const vehiclesOk = vehicles.filter(v => {
    const now = Date.now()
    const checks = [v.revTecnicaExpiry, v.soapExpiry, v.permisoCirculacionExpiry, v.nextServiceDate]
    return checks.every(d => !d || Math.ceil((new Date(d).getTime() - now) / 86400000) > 30)
  })
  const pendingCLP = cashflow._sum.netAmount ?? 0

  const vehicleAssigned = vehicles.filter(v => v.technicianId).length

  const hour = new Date().getHours()
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-ink">{greeting}, {firstName}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link href="/recursos/tecnicos" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Técnicos activos</p>
          <p className="mt-2 text-3xl font-bold text-ink">{technicians.length}</p>
          <p className="mt-1 text-xs text-gray-500">{vehicleAssigned} con camioneta asignada</p>
        </Link>

        <Link href="/recursos/vehiculos" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Vehículos</p>
          <p className="mt-2 text-3xl font-bold text-ink">{vehicles.length}</p>
          <p className={`mt-1 text-xs font-medium ${vehicleAlerts.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {vehicleAlerts.length > 0 ? `${vehicleAlerts.length} alerta${vehicleAlerts.length > 1 ? 's' : ''}` : `${vehiclesOk.length} sin alertas`}
          </p>
        </Link>

        <Link href="/tickets" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Tickets abiertos</p>
          <p className="mt-2 text-3xl font-bold text-ink">{openTickets.length}</p>
          <p className={`mt-1 text-xs font-medium ${unassigned.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {unassigned.length > 0 ? `${unassigned.length} sin asignar` : 'Todos asignados'}
            {emergencias.length > 0 && <span className="ml-1.5 text-red-700">· {emergencias.length} emergencia{emergencias.length > 1 ? 's' : ''}</span>}
          </p>
        </Link>

        <Link href="/flujo" className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Por cobrar</p>
          <p className="mt-2 text-2xl font-bold text-amber-700 tabular-nums">
            {pendingCLP > 0 ? `$${(pendingCLP / 1_000_000).toFixed(1)}M` : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Flujo de caja pendiente</p>
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

      {/* Módulos acceso rápido */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">Módulos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: 'Cronograma', desc: 'Equipos, clientes y permisos', href: '/cronograma', icon: '📅' },
            { name: 'Tickets', desc: 'Requerimientos de clientes', href: '/tickets', icon: '🎫' },
            { name: 'Flujo de Caja', desc: 'Facturación y cobranza', href: '/flujo', icon: '💵' },
            { name: 'Propuestas', desc: 'Cotizaciones PDF', href: '/cotizador', icon: '📄' },
            { name: 'Recursos', desc: 'Técnicos, vehículos, activos', href: '/recursos', icon: '🔧' },
            { name: 'Pipeline', desc: 'Cotizaciones enviadas', href: null, icon: '📊' },
          ].map((m) => m.href ? (
            <Link key={m.name} href={m.href}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand hover:shadow-md">
              <span className="text-xl">{m.icon}</span>
              <div>
                <p className="text-sm font-semibold text-ink">{m.name}</p>
                <p className="text-xs text-gray-400">{m.desc}</p>
              </div>
            </Link>
          ) : (
            <div key={m.name} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 opacity-60">
              <span className="text-xl">{m.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-400">{m.name}</p>
                <p className="text-xs text-gray-400">{m.desc} · próximamente</p>
              </div>
            </div>
          ))}
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
