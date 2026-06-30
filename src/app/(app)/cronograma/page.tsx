import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { ScheduleCalendar } from '@/components/resources/schedule-calendar'
import { requireActor } from '@/lib/tenant'
import { assignmentOptions, listAssignments, getTechnicianWorkload } from '@/lib/resources/assignments'
import type { AssigneeRoleId, AssignmentStatusId } from '@/lib/resources/labels'
import { createAssignment, deleteAssignment } from './actions'

function weekBounds(ref: Date): { from: Date; to: Date } {
  const d = new Date(ref)
  const day = (d.getDay() + 6) % 7
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59)
  return { from, to }
}

export default async function CronogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; vista?: string }>
}) {
  const actor = await requireActor()
  const sp = await searchParams
  const vista = (sp.vista as 'calendario' | 'tecnico' | 'carga') ?? 'calendario'

  const refDate = sp.semana ? new Date(sp.semana) : new Date()
  const { from, to } = weekBounds(refDate)

  const [assignments, options, workload] = await Promise.all([
    listAssignments(actor),
    assignmentOptions(actor),
    vista !== 'calendario' ? getTechnicianWorkload(actor, from, to) : Promise.resolve([]),
  ])

  const events = assignments.map((a) => ({
    id: a.id,
    title: a.title,
    start: a.start.toISOString(),
    end: a.end.toISOString(),
    status: a.status as AssignmentStatusId,
    permissionRequested: a.permissionRequested,
    client: a.client?.name ?? null,
    meetingUrl: a.meetingUrl,
    description: a.description,
    ticketCode: a.ticket?.ticketCode ?? null,
    ticketId: a.ticketId ?? null,
    assignees: a.assignees.map((x) => ({
      id: x.technician.id,
      name: x.technician.name,
      role: x.role as AssigneeRoleId,
    })),
  }))

  const scheduledTicketIds = new Set(assignments.map(a => a.ticketId).filter(Boolean))
  const unscheduledTickets = options.openTickets.filter(t => !scheduledTicketIds.has(t.id))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Cronograma</h1>
          <p className="mt-1 text-sm text-gray-500">Carga laboral, asignaciones y tickets por técnico.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden text-sm shadow-sm">
            {([
              { id: 'calendario', label: 'Calendario' },
              { id: 'tecnico', label: 'Por técnico' },
              { id: 'carga', label: 'Carga laboral' },
            ] as const).map(v => (
              <Link key={v.id}
                href={`/cronograma?vista=${v.id}${sp.semana ? `&semana=${sp.semana}` : ''}`}
                className={`px-3 py-1.5 border-r last:border-0 border-gray-200 font-medium transition-colors ${vista === v.id ? 'bg-brand text-ink' : 'text-gray-600 hover:bg-gray-50'}`}>
                {v.label}
              </Link>
            ))}
          </div>
          <Link href="/cronograma/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink hover:opacity-90">
            <PlusIcon /> Nueva asignación
          </Link>
        </div>
      </div>

      {vista === 'calendario' && (
        <ScheduleCalendar
          events={events}
          options={options}
          createAction={createAssignment}
          deleteAction={deleteAssignment}
          unscheduledTickets={unscheduledTickets}
        />
      )}

      {vista === 'tecnico' && <TechSwimlane workload={workload} from={from} to={to} />}
      {vista === 'carga' && <WorkloadTable workload={workload} from={from} to={to} />}

      {unscheduledTickets.length > 0 && vista === 'calendario' && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              Tickets sin programar
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {unscheduledTickets.length}
              </span>
            </h2>
            <Link href="/tickets" className="text-xs text-brand hover:underline">Ver todos</Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unscheduledTickets.slice(0, 9).map((t) => (
              <Link key={t.id} href={`/cronograma/new?ticketId=${t.id}`}
                className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-brand hover:shadow-md transition">
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${t.urgency === 'emergencia' ? 'bg-red-500' : t.urgency === 'urgencia' ? 'bg-amber-500' : 'bg-gray-300'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-gray-400">{t.ticketCode}</p>
                  <p className="text-sm font-medium text-ink truncate">{t.title}</p>
                  <p className="text-xs text-gray-500">{t.client.name}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs text-brand opacity-0 group-hover:opacity-100 transition self-center">Programar</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const TECH_COLORS = [
  'bg-blue-100 border-blue-300 text-blue-900',
  'bg-purple-100 border-purple-300 text-purple-900',
  'bg-green-100 border-green-300 text-green-900',
  'bg-orange-100 border-orange-300 text-orange-900',
  'bg-pink-100 border-pink-300 text-pink-900',
  'bg-teal-100 border-teal-300 text-teal-900',
]

function NavWeek({ vista, from }: { vista: string; from: Date }) {
  const prevWeek = new Date(from)
  prevWeek.setDate(from.getDate() - 7)
  const nextWeek = new Date(from)
  nextWeek.setDate(from.getDate() + 7)
  const to = new Date(from)
  to.setDate(from.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return (
    <div className="mb-4 flex items-center justify-between">
      <Link href={`/cronograma?vista=${vista}&semana=${fmt(prevWeek)}`}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
        Anterior
      </Link>
      <span className="text-sm font-semibold text-gray-700">
        {from.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} al {to.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
      </span>
      <Link href={`/cronograma?vista=${vista}&semana=${fmt(nextWeek)}`}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
        Siguiente
      </Link>
    </div>
  )
}

function TechSwimlane({ workload, from, to }: {
  workload: Awaited<ReturnType<typeof getTechnicianWorkload>>
  from: Date
  to: Date
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    return d
  })
  return (
    <div>
      <NavWeek vista="tecnico" from={from} />
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-36 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Técnico</th>
              {days.map((d, i) => {
                const isToday = d.toDateString() === new Date().toDateString()
                return (
                  <th key={i} className={`px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-brand' : 'text-gray-500'}`}>
                    <span className="block">{DAYS_ES[i]}</span>
                    <span className={`block text-base font-bold ${isToday ? 'text-brand' : 'text-ink'}`}>{d.getDate()}</span>
                  </th>
                )
              })}
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {workload.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">Sin técnicos activos</td></tr>
            ) : workload.map((tech, ti) => {
              const color = TECH_COLORS[ti % TECH_COLORS.length]
              const dayJobs = days.map(d => {
                const dk = d.toDateString()
                return tech.assignments.filter(a => new Date(a.start).toDateString() === dk)
              })
              return (
                <tr key={tech.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/recursos/tecnicos/${tech.id}`} className="hover:underline">
                      <p className="text-sm font-semibold text-ink">{tech.name.split(' ').slice(0, 2).join(' ')}</p>
                      {tech.specialty && <p className="text-xs text-gray-400 truncate max-w-[120px]">{tech.specialty}</p>}
                    </Link>
                  </td>
                  {dayJobs.map((jobs, di) => (
                    <td key={di} className="px-1 py-1.5 align-top">
                      {jobs.length === 0 ? (
                        <Link href={`/cronograma/new?fecha=${days[di].toISOString().slice(0, 10)}`}
                          className="flex h-8 items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-300 hover:border-brand hover:text-brand transition">
                          +
                        </Link>
                      ) : (
                        <div className="space-y-1">
                          {jobs.map(j => (
                            <Link key={j.id} href={`/cronograma/${j.id}`}
                              className={`block rounded border px-1.5 py-1 text-xs leading-tight hover:opacity-80 transition ${color}`}>
                              <p className="font-semibold truncate">{j.title}</p>
                              {j.client && <p className="opacity-70 truncate">{j.client.name}</p>}
                              <p className="opacity-60 tabular-nums">
                                {new Date(j.start).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                {'-'}
                                {new Date(j.end).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {j.ticket && (
                                <span className={`inline-block mt-0.5 rounded px-1 text-[10px] font-bold ${j.ticket.urgency === 'emergencia' ? 'bg-red-200 text-red-800' : 'bg-white/50'}`}>
                                  {j.ticket.ticketCode}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center">
                    <span className={`text-lg font-bold ${tech.totalJobs === 0 ? 'text-gray-300' : tech.totalJobs >= 5 ? 'text-red-600' : 'text-ink'}`}>
                      {tech.totalJobs}
                    </span>
                    <p className="text-[10px] text-gray-400">{tech.totalHours}h</p>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WorkloadTable({ workload, from, to }: {
  workload: Awaited<ReturnType<typeof getTechnicianWorkload>>
  from: Date
  to: Date
}) {
  const maxJobs = Math.max(...workload.map(t => t.totalJobs), 1)
  return (
    <div>
      <NavWeek vista="carga" from={from} />
      <div className="space-y-3">
        {workload.length === 0 ? (
          <p className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-400">No hay técnicos activos.</p>
        ) : workload.map((tech) => {
          const pct = (tech.totalJobs / maxJobs) * 100
          const barColor = tech.totalJobs === 0 ? 'bg-gray-200' : tech.totalJobs >= 5 ? 'bg-red-400' : tech.totalJobs >= 3 ? 'bg-amber-400' : 'bg-green-400'
          return (
            <div key={tech.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/recursos/tecnicos/${tech.id}`} className="font-semibold text-ink hover:underline">{tech.name}</Link>
                  {tech.specialty && <p className="text-xs text-gray-400">{tech.specialty}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-ink">{tech.totalJobs}</p>
                  <p className="text-xs text-gray-400">{tech.totalHours}h esta semana</p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              {tech.assignments.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {tech.assignments.map(a => (
                    <li key={a.id}>
                      <Link href={`/cronograma/${a.id}`}
                        className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-gray-50 text-sm transition">
                        <span className="w-20 shrink-0 text-xs text-gray-400">
                          {new Date(a.start).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })}
                        </span>
                        <span className="font-medium text-ink truncate flex-1">{a.title}</span>
                        {a.client && <span className="text-xs text-gray-500 shrink-0">{a.client.name}</span>}
                        {a.ticket && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono text-blue-700 shrink-0">
                            {a.ticket.ticketCode}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {tech.totalJobs === 0 && <p className="mt-2 text-xs text-gray-400">Sin trabajos esta semana.</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
