'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/resources/actor'
import { assignmentInputSchema, type AssigneeInput } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'

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

export async function createAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  await prisma.assignment.create({
    data: {
      ...scalarData(parsed.data),
      tenantId: actor.tenantId,
      assignees: { create: parsed.data.assignees.map((a) => ({ technicianId: a.technicianId, role: a.role })) },
    },
  })
  revalidatePath('/cronograma')
  redirect('/cronograma')
}

export async function updateAssignment(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const existing = await prisma.assignment.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  // Replace assignees wholesale (simplest reconciliation for a small team list).
  await prisma.$transaction([
    prisma.assignmentAssignee.deleteMany({ where: { assignmentId: id } }),
    prisma.assignment.update({
      where: { id },
      data: {
        ...scalarData(parsed.data),
        assignees: { create: parsed.data.assignees.map((a) => ({ technicianId: a.technicianId, role: a.role })) },
      },
    }),
  ])
  revalidatePath('/cronograma')
  redirect('/cronograma')
}

export async function deleteAssignment(id: string): Promise<void> {
  const actor = await requireActor()
  const existing = await prisma.assignment.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.assignment.delete({ where: { id } })
  revalidatePath('/cronograma')
}
