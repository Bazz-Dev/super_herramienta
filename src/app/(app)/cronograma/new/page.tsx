import Link from 'next/link'
import { AssignmentForm } from '@/components/resources/assignment-form'
import { requireActor } from '@/lib/tenant'
import { assignmentOptions } from '@/lib/resources/assignments'
import { toDatetimeLocal } from '@/lib/resources/dates'
import { createAssignment } from '../actions'

export default async function NewAsignacionPage({
  searchParams,
}: {
  searchParams: Promise<{ ticketId?: string; fecha?: string }>
}) {
  const actor = await requireActor()
  const sp = await searchParams
  const options = await assignmentOptions(actor)

  // Pre-fill start/end from ?fecha= param (from swimlane "+" click)
  const initial: Record<string, string> = {}
  if (sp.fecha) {
    const d = new Date(sp.fecha + 'T09:00')
    const e = new Date(sp.fecha + 'T17:00')
    initial.start = toDatetimeLocal(d)
    initial.end   = toDatetimeLocal(e)
  }

  // Pre-fill ticket title from ?ticketId=
  const preTicket = sp.ticketId
    ? options.openTickets.find(t => t.id === sp.ticketId)
    : null
  if (preTicket && !initial.title) {
    initial.title = preTicket.title
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/cronograma" className="text-xs text-gray-400 hover:text-gray-600">← Cronograma</Link>
      <h1 className="mb-1 text-2xl font-bold">Nueva asignación</h1>
      {preTicket && (
        <p className="mb-6 text-sm text-gray-500">
          Programando ticket <span className="font-mono font-semibold text-brand">{preTicket.ticketCode}</span> — {preTicket.title}
        </p>
      )}
      {!preTicket && <div className="mb-6" />}
      <AssignmentForm
        action={createAssignment}
        options={options}
        initial={initial}
        submitLabel="Crear asignación"
        preselectedTicketId={sp.ticketId ?? null}
      />
    </div>
  )
}
