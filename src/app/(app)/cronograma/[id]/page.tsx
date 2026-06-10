import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AssignmentForm } from '@/components/resources/assignment-form'
import { requireActor } from '@/lib/resources/actor'
import { assignmentOptions, getAssignment } from '@/lib/resources/assignments'
import { toDatetimeLocal } from '@/lib/resources/dates'
import type { AssigneeRoleId } from '@/lib/resources/labels'
import { updateAssignment } from '../actions'

export default async function EditAsignacionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor()
  const { id } = await params
  const [assignment, options] = await Promise.all([getAssignment(actor, id), assignmentOptions(actor)])
  if (!assignment) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/cronograma" className="text-xs text-gray-400 hover:text-gray-600">← Cronograma</Link>
      <h1 className="mb-6 text-2xl font-bold">Editar asignación</h1>
      <AssignmentForm
        action={updateAssignment.bind(null, assignment.id)}
        options={options}
        initial={{
          title: assignment.title,
          description: assignment.description,
          start: toDatetimeLocal(assignment.start),
          end: toDatetimeLocal(assignment.end),
          status: assignment.status,
          permissionRequested: assignment.permissionRequested,
          clientId: assignment.clientId,
          meetingUrl: assignment.meetingUrl,
          assignees: assignment.assignees.map((a) => ({ technicianId: a.technicianId, role: a.role as AssigneeRoleId })),
        }}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
