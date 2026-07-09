import Link from 'next/link'
import { requireActor, tenantScope } from '@/lib/tenant'
import { getHRDashboard } from '@/lib/rrhh/queries'
import { prisma } from '@/lib/prisma'
import {
  CONTRACT_TYPE_ACTIVE,
  CONTRACT_TYPE_TERMINATED,
  CONTRACT_TYPE_LABELS,
  type ContractTypeId,
} from '@/lib/resources/labels'
import { LEAVE_STATUS_BADGE, LEAVE_STATUS_LABEL, LEAVE_TYPE_LABEL, formatClp } from '@/lib/rrhh/labels'

// ── helpers ─────────────────────────────────────────────────────────────

function tenure(hireDate: Date | null): string {
  if (!hireDate) return 'Sin registro'
  const ms = Date.now() - new Date(hireDate).getTime()
  const days = ms / 86400000
  const years = Math.floor(days / 365.25)
  const months = Math.floor((days % 365.25) / 30.44)
  if (years >= 1) return `${years} año${years !== 1 ? 's' : ''}${months > 0 ? `, ${months} mes${months !== 1 ? 'es' : ''}` : ''}`
  if (months >= 1) return `${months} mes${months !== 1 ? 'es' : ''}`
  return `${Math.floor(days)} días`
}

function accrued(hireDate: Date | null): number {
  if (!hireDate) return 0
  const years = (Date.now() - new Date(hireDate).getTime()) / (365.25 * 86400000)
  return Math.floor(years * 15)
}

function daysUntil(date: Date | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function fDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── component ────────────────────────────────────────────────────────────

export default async function RRHHPage() {
  const actor = await requireActor(['super', 'supervisor'])
  const scope = tenantScope(actor)

  const [{ technicians, leaveRequests, payrolls }, pendingFES] = await Promise.all([
    getHRDashboard(actor),
    prisma.signatureRequest.count({
      where: { ...(scope.tenantId ? { tenantId: scope.tenantId } : {}), status: 'pendiente' },
    }),
  ])

  const active = technicians.filter(
    (t) => t.active && CONTRACT_TYPE_ACTIVE.includes(t.contractType as ContractTypeId),
  )
  const terminated = technicians.filter(
    (t) => !t.active || CONTRACT_TYPE_TERMINATED.includes(t.contractType as ContractTypeId),
  )
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'pendiente')

  const now = new Date()
  const totalSalaryMonth = payrolls
    .filter((p) => p.month === now.getMonth() + 1 && p.year === now.getFullYear())
    .reduce((s, p) => s + p.baseSalary + p.extras - p.deductions, 0)

  // Compute vacation balances per technician
  const vacByTech: Record<string, number> = {}
  for (const t of technicians) {
    const used = leaveRequests
      .filter((l) => l.technician.id === t.id && l.type === 'vacaciones' && l.status === 'aprobado')
      .reduce((s, l) => s + l.days, 0)
    vacByTech[t.id] = Math.max(0, accrued(t.hireDate) - used)
  }

  // Contracts expiring within 60 days
  const expiring = active.filter((t) => {
    if (t.contractType !== 'plazo_fijo') return false
    const d = daysUntil(t.contractEndDate)
    return d !== null && d >= 0 && d <= 60
  })

  const summary = [
    { label: 'Equipo activo', value: active.length, sub: `${terminated.length} desvinculado${terminated.length !== 1 ? 's' : ''}`, href: '#equipo', accent: 'text-ink' },
    { label: 'Permisos pendientes', value: pendingLeaves.length, sub: 'requieren aprobación', href: '/rrhh/vacaciones', accent: pendingLeaves.length > 0 ? 'text-amber-600' : 'text-green-600' },
    { label: 'Firmas pendientes', value: pendingFES, sub: 'FES sin respuesta', href: '#', accent: pendingFES > 0 ? 'text-red-600' : 'text-green-600' },
    { label: 'Masa salarial', value: totalSalaryMonth > 0 ? formatClp(totalSalaryMonth) : '—', sub: 'liquidaciones del mes', href: '/rrhh/liquidaciones', accent: 'text-brand' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-0 sm:p-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Recursos Humanos</h1>
          <p className="mt-0.5 text-sm text-gray-500">Equipo INGEGAR · {active.length} activos</p>
        </div>
        <Link
          href="/recursos/tecnicos"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-gray-50 transition-colors"
        >
          Gestionar técnicos
        </Link>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold ${s.accent}`}>{s.value}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{s.sub}</p>
          </Link>
        ))}
      </div>

      {/* Alerts: expiring contracts */}
      {expiring.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
            Contratos por vencer
          </p>
          <div className="flex flex-wrap gap-2">
            {expiring.map((t) => {
              const d = daysUntil(t.contractEndDate)!
              return (
                <Link
                  key={t.id}
                  href={`/rrhh/${t.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200 transition-colors"
                >
                  {t.name}
                  <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px]">
                    {d === 0 ? 'hoy' : `${d}d`}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Team roster */}
      <div id="equipo">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Equipo activo</h2>
          <span className="text-xs text-gray-400">{active.length} persona{active.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((t) => {
            const pLeaves = pendingLeaves.filter((l) => l.technician.id === t.id).length
            const vacDays = vacByTech[t.id] ?? 0
            const contractDays = daysUntil(t.contractEndDate)
            const isExpiring = t.contractType === 'plazo_fijo' && contractDays !== null && contractDays <= 60 && contractDays >= 0

            return (
              <Link
                key={t.id}
                href={`/rrhh/${t.id}`}
                className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-brand/30 hover:shadow-md"
              >
                {/* Name row */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-base font-bold text-brand">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand transition-colors">
                      {t.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {t.specialty ?? CONTRACT_TYPE_LABELS[t.contractType as ContractTypeId]}
                    </p>
                  </div>
                  {pLeaves > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      {pLeaves} permiso{pLeaves !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Data chips */}
                <div className="flex flex-wrap gap-1.5">
                  {/* Contract type */}
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {CONTRACT_TYPE_LABELS[t.contractType as ContractTypeId]}
                  </span>

                  {/* Tenure */}
                  {t.hireDate ? (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                      {tenure(t.hireDate)}
                    </span>
                  ) : (
                    <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400">
                      Sin fecha ingreso
                    </span>
                  )}

                  {/* Vacation days */}
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    vacDays > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {vacDays} día{vacDays !== 1 ? 's' : ''} vac.
                  </span>

                  {/* Expiry warning */}
                  {isExpiring && (
                    <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                      Vence {contractDays === 0 ? 'hoy' : `en ${contractDays}d`}
                    </span>
                  )}
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between border-t border-gray-50 pt-2">
                  <p className="text-[11px] text-gray-400">
                    {t.hireDate ? `Desde ${fDate(t.hireDate)}` : 'Sin fecha de ingreso'}
                  </p>
                  {t.baseSalary ? (
                    <p className="text-[11px] font-semibold text-gray-500 tabular-nums">
                      {formatClp(t.baseSalary)}
                    </p>
                  ) : null}
                </div>
              </Link>
            )
          })}

          {active.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
              <p className="text-sm text-gray-400">Sin técnicos activos en este tenant</p>
              <Link href="/recursos/tecnicos" className="mt-2 inline-block text-xs font-medium text-brand hover:underline">
                Agregar técnico →
              </Link>
            </div>
          )}
        </div>

        {/* Desvinculados (collapsed) */}
        {terminated.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-600 select-none">
              {terminated.length} desvinculado{terminated.length !== 1 ? 's' : ''}
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {terminated.map((t) => (
                <Link
                  key={t.id}
                  href={`/rrhh/${t.id}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-200 text-sm font-bold text-gray-500">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-gray-600">{t.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {CONTRACT_TYPE_LABELS[t.contractType as ContractTypeId]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Pending leaves */}
      {pendingLeaves.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Permisos pendientes</h2>
            <Link href="/rrhh/vacaciones" className="inline-flex min-h-11 items-center text-xs font-medium text-brand hover:underline">
              Ver todos →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingLeaves.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{l.technician.name}</p>
                  <p className="text-xs text-gray-400">
                    {LEAVE_TYPE_LABEL[l.type]} · {l.days} día{l.days !== 1 ? 's' : ''} · {new Date(l.startDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} → {new Date(l.endDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEAVE_STATUS_BADGE[l.status]}`}>
                    {LEAVE_STATUS_LABEL[l.status]}
                  </span>
                  <Link
                    href="/rrhh/vacaciones"
                    className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-brand/90 transition-colors"
                  >
                    Aprobar →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/rrhh/vacaciones" className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-5 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-lg">🗓️</div>
          <div>
            <p className="text-sm font-semibold">Permisos y vacaciones</p>
            <p className="text-xs text-gray-400">Aprobar o registrar</p>
          </div>
        </Link>
        <Link href="/rrhh/liquidaciones" className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-5 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-lg">💰</div>
          <div>
            <p className="text-sm font-semibold">Liquidaciones</p>
            <p className="text-xs text-gray-400">Crear o revisar del mes</p>
          </div>
        </Link>
        <Link href="/recursos/tecnicos" className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 px-5 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-lg">👤</div>
          <div>
            <p className="text-sm font-semibold">Fichas de técnicos</p>
            <p className="text-xs text-gray-400">Datos, contratos, FES</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
