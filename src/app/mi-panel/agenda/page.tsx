import { redirect } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Agenda — INGEGAR' }

function fShort(d: Date | string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
function fTime(d: Date | string) {
  return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
function hoursLabel(h: number): string {
  if (h < 1) return '< 1 h'
  const d = Math.floor(h / 8)
  const rem = Math.round(h % 8)
  if (d === 0) return `${Math.round(h)} h`
  return `${d}d ${rem > 0 ? `${rem}h` : ''}`.trim()
}

const ASSIGN_STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500',
}
const ASSIGN_STATUS_LBL: Record<string, string> = {
  scheduled: 'Programado', in_progress: 'En ejecución', done: 'Completado', cancelled: 'Cancelado',
}

export default async function MiPanelAgendaPage() {
  const actor = await requireActor()
  if (actor.role !== 'tecnico') redirect('/dashboard')
  if (!actor.technicianId) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Tu usuario no tiene un técnico asociado. Contacta al administrador.
      </div>
    )
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const assignmentRows = await prisma.assignmentAssignee.findMany({
    where: { technicianId: actor.technicianId },
    include: {
      assignment: {
        select: {
          id: true, title: true, start: true, end: true, status: true,
          permissionRequested: true,
          client: { select: { name: true } },
          ticket: { select: { ticketCode: true, title: true, status: true } },
        },
      },
    },
    orderBy: { assignment: { start: 'desc' } },
  })

  const completedRows = assignmentRows.filter(r => r.assignment.status === 'done')
  const scheduledRows = assignmentRows.filter(r => ['scheduled', 'in_progress'].includes(r.assignment.status))
  const totalHours = completedRows.reduce((s, r) => s + (new Date(r.assignment.end).getTime() - new Date(r.assignment.start).getTime()) / 3600000, 0)
  const thisMonthHours = completedRows
    .filter(r => new Date(r.assignment.start) >= startOfMonth)
    .reduce((s, r) => s + (new Date(r.assignment.end).getTime() - new Date(r.assignment.start).getTime()) / 3600000, 0)
  const upcoming = assignmentRows
    .filter(r => new Date(r.assignment.start) >= now && r.assignment.status === 'scheduled')
    .sort((a, b) => new Date(a.assignment.start).getTime() - new Date(b.assignment.start).getTime())
  const past = assignmentRows
    .filter(r => !(new Date(r.assignment.start) >= now && r.assignment.status === 'scheduled'))

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Mi agenda</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-center">
          <p className="text-xl font-bold text-blue-700">{assignmentRows.length}</p>
          <p className="mt-0.5 text-[10px] font-medium text-blue-700 opacity-80">Trabajos totales</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
          <p className="text-xl font-bold text-amber-700">{scheduledRows.length}</p>
          <p className="mt-0.5 text-[10px] font-medium text-amber-700 opacity-80">En agenda</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-xl font-bold text-green-700">{completedRows.length}</p>
          <p className="mt-0.5 text-[10px] font-medium text-green-700 opacity-80">Completados</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-center">
          <p className="text-xl font-bold text-indigo-700">{hoursLabel(thisMonthHours)}</p>
          <p className="mt-0.5 text-[10px] font-medium text-indigo-700 opacity-80">Horas este mes</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center justify-between text-sm font-semibold text-gray-700">
          📅 Próximas asignaciones
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{upcoming.length}</span>
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">Sin trabajos programados próximamente.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.map(({ assignment, role }) => (
              <li key={assignment.id} className="py-3 flex items-start gap-2.5">
                <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${assignment.permissionRequested ? 'bg-green-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{assignment.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {fShort(assignment.start)} · {fTime(assignment.start)}–{fTime(assignment.end)}
                    {assignment.client && <span className="ml-1.5 text-gray-400">· {assignment.client.name}</span>}
                  </p>
                  {assignment.ticket && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{assignment.ticket.ticketCode}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                  {role === 'ayudante' ? 'Ayudante' : 'Técnico'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center justify-between text-sm font-semibold text-gray-700">
          🗂️ Historial
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{past.length}</span>
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-gray-400">Sin trabajos anteriores.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {past.map(({ assignment }) => (
              <li key={assignment.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{assignment.title}</p>
                  <p className="text-xs text-gray-400">{fShort(assignment.start)}{assignment.client && ` · ${assignment.client.name}`}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ASSIGN_STATUS_CLS[assignment.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {ASSIGN_STATUS_LBL[assignment.status] ?? assignment.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        {totalHours > 0 && (
          <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
            Total horas acumuladas: <span className="font-semibold text-gray-600">{hoursLabel(totalHours)}</span>
          </p>
        )}
      </div>
    </div>
  )
}
