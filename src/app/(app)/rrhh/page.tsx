import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { getHRDashboard } from '@/lib/rrhh/queries'
import { CONTRACT_TYPE_ACTIVE, CONTRACT_TYPE_TERMINATED, CONTRACT_TYPE_LABELS, type ContractTypeId } from '@/lib/resources/labels'
import { LEAVE_STATUS_BADGE, LEAVE_STATUS_LABEL, LEAVE_TYPE_LABEL, MONTH_NAMES, formatClp } from '@/lib/rrhh/labels'

export default async function RRHHPage() {
  const actor = await requireActor(['super', 'supervisor'])
  const { technicians, leaveRequests, payrolls } = await getHRDashboard(actor)

  const active = technicians.filter(t => t.active && CONTRACT_TYPE_ACTIVE.includes(t.contractType as ContractTypeId))
  const terminated = technicians.filter(t => !t.active || CONTRACT_TYPE_TERMINATED.includes(t.contractType as ContractTypeId))
  const pendingLeaves = leaveRequests.filter(l => l.status === 'pendiente')
  const recentLeaves = leaveRequests.slice(0, 5)

  const totalPayrollThisMonth = payrolls
    .filter(p => { const now = new Date(); return p.month === now.getMonth() + 1 && p.year === now.getFullYear() })
    .reduce((s, p) => s + p.baseSalary + p.extras - p.deductions, 0)

  const kpis = [
    { label: 'Plantilla activa', value: active.length, sub: `${terminated.length} desvinculado${terminated.length !== 1 ? 's' : ''}`, href: '/rrhh', color: '#f5b100' },
    { label: 'Permisos pendientes', value: pendingLeaves.length, sub: 'requieren aprobación', href: '/rrhh/vacaciones', color: pendingLeaves.length > 0 ? '#f59e0b' : '#10b981' },
    { label: 'Masa salarial (mes)', value: totalPayrollThisMonth > 0 ? formatClp(totalPayrollThisMonth) : '—', sub: 'liquidaciones del mes actual', href: '/rrhh/liquidaciones', color: '#3b82f6' },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Recursos Humanos</h1>
        <p className="mt-1 text-sm text-gray-500">Gestión de personas, permisos y liquidaciones del equipo INGEGAR.</p>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map(k => (
          <Link key={k.label} href={k.href} className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="mt-0.5 text-xs text-gray-400">{k.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Team list */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Equipo activo</h2>
            <Link href="/recursos/tecnicos" className="inline-flex min-h-11 items-center text-xs font-medium text-brand hover:underline">Gestionar →</Link>
          </div>
          <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
            {active.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Sin técnicos activos</p>
            )}
            {active.map(t => (
              <Link key={t.id} href={`/rrhh/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                  {t.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.specialty ?? CONTRACT_TYPE_LABELS[t.contractType]}</p>
                </div>
                {t.baseSalary && (
                  <span className="text-xs tabular-nums text-gray-400">{formatClp(t.baseSalary)}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Recent leave requests */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Permisos recientes</h2>
            <Link href="/rrhh/vacaciones" className="inline-flex min-h-11 items-center text-xs font-medium text-brand hover:underline">Ver todos →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentLeaves.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">Sin solicitudes</p>
            )}
            {recentLeaves.map(l => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{l.technician.name}</p>
                  <p className="text-xs text-gray-400">
                    {LEAVE_TYPE_LABEL[l.type]} · {l.days} día{l.days !== 1 ? 's' : ''} · {new Date(l.startDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className={`ml-3 flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEAVE_STATUS_BADGE[l.status]}`}>
                  {LEAVE_STATUS_LABEL[l.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/rrhh/vacaciones?new=1" className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-5 py-4 hover:bg-gray-50 transition-colors">
          <span className="text-xl">🗓️</span>
          <div>
            <p className="text-sm font-semibold">Registrar permiso</p>
            <p className="text-xs text-gray-400">Vacaciones, licencias, permisos</p>
          </div>
        </Link>
        <Link href="/rrhh/liquidaciones?new=1" className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-5 py-4 hover:bg-gray-50 transition-colors">
          <span className="text-xl">💰</span>
          <div>
            <p className="text-sm font-semibold">Nueva liquidación</p>
            <p className="text-xs text-gray-400">Crear liquidación del mes</p>
          </div>
        </Link>
        <Link href="/mi-panel" className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-5 py-4 hover:bg-gray-50 transition-colors">
          <span className="text-xl">✍️</span>
          <div>
            <p className="text-sm font-semibold">FES — Firma de documentos</p>
            <p className="text-xs text-gray-400">Firma electrónica simple</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
