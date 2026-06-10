import Link from 'next/link'
import { AssignmentForm } from '@/components/resources/assignment-form'
import { requireActor } from '@/lib/resources/actor'
import { assignmentOptions } from '@/lib/resources/assignments'
import { createAssignment } from '../actions'

export default async function NewAsignacionPage() {
  const actor = await requireActor()
  const options = await assignmentOptions(actor)
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/recursos/cronograma" className="text-xs text-gray-400 hover:text-gray-600">← Cronograma</Link>
      <h1 className="mb-6 text-2xl font-bold">Nueva asignación</h1>
      <AssignmentForm action={createAssignment} options={options} submitLabel="Crear asignación" />
    </div>
  )
}
