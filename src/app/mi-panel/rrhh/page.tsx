import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { SignaturePendingList } from '../signature-pending-list'
import { DOC_TYPE_LABELS, type DocTypeId } from '@/lib/resources/labels'
import {
  LEAVE_TYPE_LABEL, LEAVE_STATUS_BADGE, LEAVE_STATUS_LABEL,
  PAYROLL_STATUS_BADGE, PAYROLL_STATUS_LABEL, MONTH_NAMES, formatClp,
} from '@/lib/rrhh/labels'
import { TecnicoLeaveForm } from '@/components/rrhh/tecnico-leave-form'

export const metadata = { title: 'RR.HH. — INGEGAR' }

function fDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fShort(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
function yearsMonths(from: Date | null | undefined): string {
  if (!from) return '—'
  const ms = Date.now() - new Date(from).getTime()
  const years = Math.floor(ms / (365.25 * 24 * 3600000))
  const months = Math.floor((ms % (365.25 * 24 * 3600000)) / (30.44 * 24 * 3600000))
  if (years === 0) return `${months} mes${months !== 1 ? 'es' : ''}`
  return `${years} año${years !== 1 ? 's' : ''}${months > 0 ? ` ${months}m` : ''}`
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

export default async function MiPanelRRHHPage() {
  const actor = await requireActor()
  if (actor.role !== 'tecnico') redirect('/dashboard')
  if (!actor.technicianId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Tu usuario no tiene un técnico asociado. Contacta al administrador.
      </div>
    )
  }

  const [technician, leaveRequests, pendingLeavesCount, payrolls, techDocs, pendingSignatures, signedSignatures] = await Promise.all([
    prisma.technician.findUnique({ where: { id: actor.technicianId } }),
    prisma.leaveRequest.findMany({ where: { technicianId: actor.technicianId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.leaveRequest.count({ where: { technicianId: actor.technicianId, status: 'pendiente' } }),
    prisma.payroll.findMany({ where: { technicianId: actor.technicianId }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 }),
    prisma.technicianDocument.findMany({ where: { technicianId: actor.technicianId }, orderBy: [{ expiryDate: 'asc' }, { uploadedAt: 'desc' }] }),
    prisma.signatureRequest.findMany({ where: { technicianId: actor.technicianId, status: 'pendiente' }, orderBy: { createdAt: 'desc' } }),
    prisma.signatureRequest.findMany({ where: { technicianId: actor.technicianId, status: { not: 'pendiente' } }, orderBy: { updatedAt: 'desc' }, take: 5 }),
  ])
  if (!technician) redirect('/login')

  const pendingSerialized = pendingSignatures.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null }))
  const signedSerialized  = signedSignatures.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), signedAt: r.signedAt?.toISOString() ?? null }))
  const lastPayroll = payrolls[0]

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-xl font-bold text-ink">RR.HH.</h1>

      {/* Contrato */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">📋 Mi contrato</h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          {technician.hireDate && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Ingreso</p>
              <p className="font-medium text-ink">{fDate(technician.hireDate)}</p>
              <p className="text-xs text-gray-400">{yearsMonths(technician.hireDate)}</p>
            </div>
          )}
          {technician.baseSalary != null && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Sueldo base</p>
              <p className="font-medium text-ink">{formatClp(technician.baseSalary)}</p>
            </div>
          )}
          {technician.dailyRate != null && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Jornal</p>
              <p className="font-medium text-ink">{formatClp(technician.dailyRate)}/día</p>
            </div>
          )}
          {technician.contractEndDate && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Vence</p>
              <p className={`font-medium ${expiryInfo(technician.contractEndDate).cls}`}>{fDate(technician.contractEndDate)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Permisos y licencias */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">🗓️ Permisos y licencias</h2>
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
                <p className="text-gray-400 mt-0.5">{fShort(lr.startDate)} – {fShort(lr.endDate)} · {lr.days}d</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Liquidaciones */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">💰 Liquidaciones</h2>
        {!lastPayroll ? (
          <p className="text-sm text-gray-400">Sin liquidaciones emitidas.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {payrolls.map(p => (
              <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PAYROLL_STATUS_BADGE[p.status]}`}>
                    {PAYROLL_STATUS_LABEL[p.status]}
                  </span>
                  <span className="text-gray-600">{MONTH_NAMES[p.month]} {p.year}</span>
                </div>
                <span className="font-semibold text-ink">{formatClp(p.baseSalary + p.extras - p.deductions)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documentos */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center justify-between text-sm font-semibold text-gray-700">
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
                    <p className="font-medium text-gray-800 truncate">{doc.label ?? DOC_TYPE_LABELS[doc.type as DocTypeId]}</p>
                    {doc.expiryDate && <p className={`${cls} mt-0.5`}>Vence: {dLabel}</p>}
                  </div>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-brand hover:underline font-medium">Ver ↗</a>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* FES */}
      {(pendingSerialized.length > 0 || signedSerialized.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
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
    </div>
  )
}
