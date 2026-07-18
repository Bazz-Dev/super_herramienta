'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { assignmentInputSchema, type AssigneeInput } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'
import { notify } from '@/lib/push'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parseAssignees(raw: FormDataEntryValue | null): AssigneeInput[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter((a) => a && typeof a.technicianId === 'string')
      .map((a) => ({ technicianId: a.technicianId, role: a.role === 'ayudante' ? 'ayudante' : 'tecnico' }))
  } catch {
    return []
  }
}

function parse(formData: FormData) {
  return assignmentInputSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    start: formData.get('start'),
    end: formData.get('end'),
    status: formData.get('status'),
    permissionRequested: formData.get('permissionRequested') === 'on',
    clientId: formData.get('clientId'),
    meetingUrl: formData.get('meetingUrl'),
    assignees: parseAssignees(formData.get('assignees')),
  })
}

type Parsed = ReturnType<typeof assignmentInputSchema.parse>

function scalarData(input: Parsed) {
  return {
    title: input.title,
    description: input.description ?? null,
    start: new Date(input.start),
    end: new Date(input.end),
    status: input.status,
    permissionRequested: input.permissionRequested,
    clientId: input.clientId ?? null,
    meetingUrl: input.meetingUrl ?? null,
  }
}

async function resolveTicketId(rawId: FormDataEntryValue | null, tenantId: string): Promise<string | null> {
  if (typeof rawId !== 'string' || !rawId) return null
  const ticket = await prisma.ticket.findFirst({
    where: { id: rawId, tenantId, deletedAt: null },
    select: { id: true },
  })
  return ticket?.id ?? null
}

// G36: una vacación/permiso aprobado no bloqueaba agendar al técnico ese día.
async function leaveConflictError(technicianIds: string[], start: Date, end: Date): Promise<string | null> {
  if (technicianIds.length === 0) return null
  const conflicts = await prisma.leaveRequest.findMany({
    where: {
      technicianId: { in: technicianIds },
      status: 'aprobado',
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { technician: { select: { name: true } } },
  })
  if (conflicts.length === 0) return null
  const names = [...new Set(conflicts.map((c) => c.technician.name))]
  return `${names.join(', ')} tiene un permiso/vacación aprobado en esas fechas.`
}

export async function createAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const leaveError = await leaveConflictError(
    parsed.data.assignees.map((a) => a.technicianId),
    new Date(parsed.data.start),
    new Date(parsed.data.end),
  )
  if (leaveError) return { error: leaveError }
  const ticketId = await resolveTicketId(formData.get('ticketId'), actor.tenantId)
  const assignment = await prisma.assignment.create({
    data: {
      ...scalarData(parsed.data),
      tenantId: actor.tenantId,
      ticketId,
      assignees: { create: parsed.data.assignees.map((a) => ({ technicianId: a.technicianId, role: a.role })) },
    },
  })

  // Notify assigned technicians (those with a linked User account)
  if (parsed.data.assignees.length > 0) {
    const techUsers = await prisma.user.findMany({
      where: { technicianId: { in: parsed.data.assignees.map((a) => a.technicianId) }, role: 'tecnico' },
      select: { id: true, tenantId: true },
    })
    const startStr = new Date(parsed.data.start).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
    for (const u of techUsers) {
      notify(u.id, u.tenantId, {
        type: 'assignment_created',
        title: `Nueva asignación: ${parsed.data.title}`,
        body: `Programado para el ${startStr}`,
        href: '/mi-panel',
      }).catch(() => {})
    }
  }

  revalidatePath('/cronograma')
  redirect('/cronograma')
}

export async function updateAssignment(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.assignment.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const leaveError = await leaveConflictError(
    parsed.data.assignees.map((a) => a.technicianId),
    new Date(parsed.data.start),
    new Date(parsed.data.end),
  )
  if (leaveError) return { error: leaveError }
  const ticketId = await resolveTicketId(formData.get('ticketId'), actor.tenantId)
  // Replace assignees wholesale (simplest reconciliation for a small team list).
  await prisma.$transaction([
    prisma.assignmentAssignee.deleteMany({ where: { assignmentId: id } }),
    prisma.assignment.update({
      where: { id },
      data: {
        ...scalarData(parsed.data),
        ticketId,
        assignees: { create: parsed.data.assignees.map((a) => ({ technicianId: a.technicianId, role: a.role })) },
      },
    }),
  ])
  revalidatePath('/cronograma')
  redirect('/cronograma')
}

export async function deleteAssignment(id: string): Promise<void> {
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.assignment.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.assignment.delete({ where: { id } })
  revalidatePath('/cronograma')
}
