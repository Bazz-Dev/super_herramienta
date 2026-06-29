import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { ScheduleCalendar } from '@/components/resources/schedule-calendar'
import { requireActor } from '@/lib/tenant'
import { assignmentOptions, listAssignments } from '@/lib/resources/assignments'
import { formatDateTime } from '@/lib/resources/dates'
import {
  ASSIGNEE_ROLE_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  permissionEventColor,
  type AssigneeRoleId,
  type AssignmentStatusId,
} from '@/lib/resources/labels'
import { createAssignment, deleteAssignment } from './actions'

export default async function CronogramaPage() {
  const actor = await requireActor()
  const [assignments, options] = await Promise.all([listAssignments(actor), assignmentOptions(actor)])

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
    assignees: a.assignees.map((x) => ({ id: x.technician.id, name: x.technician.name, role: x.role as AssigneeRoleId })),
  }))

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">← Dashboard</Link>
          <h1 className="text-2xl font-bold">Cronograma</h1>
          <p className="mt-1 text-sm text-gray-500">Qué técnicos están con qué cliente, cuándo y si hay permiso de sucursal.</p>
        </div>
        <Link
          href="/cronograma/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          <PlusIcon /> Nueva asignación
        </Link>
      </div>

      <div className="mt-5">
        <ScheduleCalendar events={events} options={options} createAction={createAssignment} deleteAction={deleteAssignment} />
      </div>

      <h2 className="mt-8 mb-2 text-sm font-semibold text-gray-600">Asignaciones</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {assignments.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Aún no hay asignaciones. Crea la primera.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Título</th>
                <th className="px-4 py-2.5 font-medium">Inicio</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Equipo</th>
                <th className="px-4 py-2.5 font-medium">Permiso</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const team =
                  a.assignees.map((x) => `${x.technician.name} (${ASSIGNEE_ROLE_LABELS[x.role as AssigneeRoleId]})`).join(', ') || '—'
                return (
                  <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 font-medium text-ink">{a.title}</td>
                    <td className="px-4 py-2.5 text-gray-600">{formatDateTime(a.start)}</td>
                    <td className="px-4 py-2.5 text-gray-600">{a.client?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{team}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${permissionEventColor(a.permissionRequested, a.status as AssignmentStatusId)}`}>
                        {a.status === 'cancelled'
                          ? ASSIGNMENT_STATUS_LABELS.cancelled
                          : a.permissionRequested
                            ? 'Sí'
                            : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/cronograma/${a.id}`}
                          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          Editar
                        </Link>
                        <DeleteButton action={deleteAssignment.bind(null, a.id)} confirmText={`¿Eliminar "${a.title}"?`} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
