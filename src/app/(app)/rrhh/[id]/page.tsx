import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { getTechnicianProfile } from '@/lib/rrhh/queries'
import { prisma } from '@/lib/prisma'
import { CONTRACT_TYPE_LABELS, CONTRACT_TYPE_ACTIVE, DOC_TYPE_LABELS, type ContractTypeId } from '@/lib/resources/labels'
import { LEAVE_TYPE_LABEL, LEAVE_STATUS_BADGE, LEAVE_STATUS_LABEL, PAYROLL_STATUS_BADGE, PAYROLL_STATUS_LABEL, MONTH_NAMES, formatClp } from '@/lib/rrhh/labels'
import { TechnicianHRForm } from '@/components/rrhh/technician-hr-form'

type TechProfile = NonNullable<Awaited<ReturnType<typeof getTechnicianProfile>>>

interface Props {
  params: Promise<{ id: string }>
}

function fDate(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function TechnicianProfilePage({ params }: Props) {
  const { id } = await params
  const actor = await requireActor(['super', 'supervisor'])
  const tech = await getTechnicianProfile(actor, id)
  if (!tech) notFound()

  const techTickets = tech.user
    ? await prisma.ticket.findMany({
        where: {
          assignedToId: tech.user.id,
          tenantId: actor.tenantId,
          deletedAt: null,
        },
        select: {
          id: true, ticketCode: true, title: true, status: true, urgency: true,
          updatedAt: true, estimatedDate: true,
          client: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 20,
      })
    : []

  const isActive = tech.active && CONTRACT_TYPE_ACTIVE.includes(tech.contractType as ContractTypeId)
  const totalLeavedays = tech.leaveRequests.filter(l => l.status === 'aprobado').reduce((s, l) => s + l.days, 0)

  // Tenure + vacation balance
  function calcTenure(hireDate: Date | null) {
    if (!hireDate) return null
    const ms = Date.now() - new Date(hireDate).getTime()
    const years = Math.floor(ms / (365.25 * 86400000))
    const months = Math.floor((ms % (365.25 * 86400000)) / (30.44 * 86400000))
    if (years >= 1) return `${years} año${years !== 1 ? 's' : ''}${months > 0 ? `, ${months} mes${months !== 1 ? 'es' : ''}` : ''}`
    if (months >= 1) return `${months} mes${months !== 1 ? 'es' : ''}`
    return `${Math.floor(ms / 86400000)} días`
  }
  const tenure = calcTenure(tech.hireDate)
  const accruedVac = tech.hireDate ? Math.floor((Date.now() - new Date(tech.hireDate).getTime()) / (365.25 * 86400000) * 15) : 0
  const usedVac = tech.leaveRequests.filter(l => l.type === 'vacaciones' && l.status === 'aprobado').reduce((s, l) => s + l.days, 0)
  const availableVac = Math.max(0, accruedVac - usedVac)

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/rrhh" className="hover:text-gray-600">RR.HH.</Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">{tech.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xl font-bold text-brand">
            {tech.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tech.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              {tech.rut && <span>{tech.rut}</span>}
              {tech.specialty && <><span>·</span><span>{tech.specialty}</span></>}
              <span>·</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {CONTRACT_TYPE_LABELS[tech.contractType]}
              </span>
            </div>
          </div>
        </div>
        <Link
          href={`/recursos/tecnicos`}
          className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          Editar ficha →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: personal + contract */}
        <div className="flex flex-col gap-4 lg:col-span-1">
          {/* Personal */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Datos personales</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Email" value={tech.email} />
              <Row label="Teléfono" value={tech.phone} />
              {tech.phone2 && <Row label="Teléfono 2" value={tech.phone2} />}
              <Row label="Dirección" value={tech.address} />
              {tech.mutualidad && <Row label="Mutualidad" value={tech.mutualidad} />}
              <Row label="Nacimiento" value={fDate(tech.birthDate)} />
              <Row label="Contacto emergencia" value={tech.emergencyContact} />
              <Row label="Tel. emergencia" value={tech.emergencyPhone} />
            </dl>
          </section>

          {/* Contract */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Contrato</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Tipo" value={CONTRACT_TYPE_LABELS[tech.contractType]} />
              <Row label="Ingreso" value={fDate(tech.hireDate)} />
              {tenure && <Row label="Antigüedad" value={tenure} />}
              {tech.contractEndDate && <Row label="Venc. contrato" value={fDate(tech.contractEndDate)} />}
              <Row label="Sueldo base" value={tech.baseSalary ? formatClp(tech.baseSalary) : undefined} />
              {tech.dailyRate && <Row label="Tarifa diaria" value={formatClp(tech.dailyRate)} />}
            </dl>
            {tech.hireDate && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <div className="flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Vacaciones disponibles</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-800">{availableVac} días</p>
                  <p className="text-[10px] text-gray-400">{accruedVac} acumulados · {usedVac} usados</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${availableVac > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {availableVac > 0 ? 'Con saldo' : 'Sin saldo'}
                </span>
              </div>
            )}
          </section>

          {/* HR editable fields */}
          <TechnicianHRForm
            techId={tech.id}
            hireDate={tech.hireDate?.toISOString().slice(0, 10) ?? null}
            baseSalary={tech.baseSalary ?? null}
            address={tech.address ?? null}
            emergencyContact={tech.emergencyContact ?? null}
            emergencyPhone={tech.emergencyPhone ?? null}
            phone2={tech.phone2 ?? null}
            mutualidad={tech.mutualidad ?? null}
          />
        </div>

        {/* Right: tabs panels */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Leave summary */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Permisos y ausencias</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{totalLeavedays} días tomados</span>
                <Link href={`/rrhh/vacaciones?techId=${tech.id}`} className="text-xs font-medium text-brand hover:underline">
                  + Agregar
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {tech.leaveRequests.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin solicitudes registradas</p>
              )}
              {tech.leaveRequests.map(l => (
                <div key={l.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{LEAVE_TYPE_LABEL[l.type]}</p>
                    <p className="text-[11px] text-gray-400">
                      {fDate(l.startDate)} → {fDate(l.endDate)} · {l.days} día{l.days !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${LEAVE_STATUS_BADGE[l.status]}`}>
                    {LEAVE_STATUS_LABEL[l.status]}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Payrolls */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Liquidaciones</h2>
              <Link href={`/rrhh/liquidaciones?techId=${tech.id}`} className="text-xs font-medium text-brand hover:underline">
                + Nueva
              </Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {tech.payrolls.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin liquidaciones</p>
              )}
              {tech.payrolls.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{MONTH_NAMES[p.month]} {p.year}</p>
                    <p className="text-[11px] text-gray-400">
                      Base {formatClp(p.baseSalary)}
                      {p.extras > 0 && <span> + {formatClp(p.extras)}</span>}
                      {p.deductions > 0 && <span> − {formatClp(p.deductions)}</span>}
                      {' '}= <strong>{formatClp(p.baseSalary + p.extras - p.deductions)}</strong>
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PAYROLL_STATUS_BADGE[p.status]}`}>
                    {PAYROLL_STATUS_LABEL[p.status]}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Recent assignments */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Historial de trabajos</h2>
              <span className="text-xs text-gray-400">{tech.assignees.length} registros</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {tech.assignees.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin asignaciones</p>
              )}
              {tech.assignees.map(a => (
                <div key={a.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{a.assignment.title}</p>
                    <p className="text-[11px] text-gray-400">
                      {a.assignment.client?.name ?? '—'} · {a.assignment.start ? fDate(a.assignment.start) : '—'}
                    </p>
                  </div>
                  <span className="text-[11px] capitalize text-gray-400">{a.role}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Tickets assigned */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Tickets asignados</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{techTickets.length} tickets</span>
                <Link href={`/tickets?assignedTo=${tech.user?.id ?? ''}`} className="text-xs font-medium text-brand hover:underline">Ver todos →</Link>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {techTickets.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin tickets asignados</p>
              )}
              {techTickets.map(t => {
                const URGENCY_CLS: Record<string, string> = {
                  emergencia: 'bg-red-100 text-red-700', urgencia: 'bg-orange-100 text-orange-700',
                  no_urgente: 'bg-gray-100 text-gray-500', preventivo: 'bg-teal-100 text-teal-700',
                }
                const STATUS_CLS: Record<string, string> = {
                  nuevo: 'bg-blue-100 text-blue-700', en_revision: 'bg-purple-100 text-purple-700',
                  en_ejecucion: 'bg-amber-100 text-amber-700', esperando_aprobacion: 'bg-orange-100 text-orange-700',
                  resuelto: 'bg-green-100 text-green-700', cancelado: 'bg-gray-100 text-gray-500',
                }
                const STATUS_LBL: Record<string, string> = {
                  nuevo: 'Nuevo', en_revision: 'En revisión', en_ejecucion: 'En ejecución',
                  esperando_aprobacion: 'Esp. aprobación', resuelto: 'Resuelto', cancelado: 'Cancelado', fusionado: 'Fusionado',
                }
                const URGENCY_LBL: Record<string, string> = {
                  emergencia: 'Emergencia', urgencia: 'Urgente', no_urgente: 'Normal', preventivo: 'Preventivo',
                }
                return (
                  <div key={t.id} className="flex items-start justify-between px-5 py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-[10px] text-gray-400">{t.ticketCode}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLS[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LBL[t.status] ?? t.status}
                        </span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${URGENCY_CLS[t.urgency] ?? 'bg-gray-100 text-gray-500'}`}>
                          {URGENCY_LBL[t.urgency] ?? t.urgency}
                        </span>
                      </div>
                      <Link href={`/tickets/${t.id}`} className="text-xs font-medium text-gray-800 hover:text-brand truncate block">
                        {t.title}
                      </Link>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {t.client?.name}{t.branch && ` · ${t.branch.name}`}
                        {t.estimatedDate && ` · ${fDate(t.estimatedDate)}`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Documents */}
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold">Documentos</h2>
              <Link href={`/recursos/tecnicos`} className="text-xs font-medium text-brand hover:underline">Gestionar →</Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
              {tech.documents.length === 0 && (
                <p className="px-5 py-6 text-center text-xs text-gray-400">Sin documentos</p>
              )}
              {tech.documents.map(d => (
                <div key={d.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-xs font-medium text-gray-700">{d.label ?? DOC_TYPE_LABELS[d.type]}</p>
                    {d.expiryDate && <p className="text-[11px] text-gray-400">Vence: {fDate(d.expiryDate)}</p>}
                  </div>
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-brand hover:underline"
                  >
                    Ver
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-400 shrink-0">{label}</dt>
      <dd className="text-right font-medium text-gray-700 truncate">{value ?? '—'}</dd>
    </div>
  )
}
