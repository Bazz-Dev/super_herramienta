'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/resources/actor'
import { assignmentInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parse(formData: FormData) {
  return assignmentInputSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    start: formData.get('start'),
    end: formData.get('end'),
    status: formData.get('status'),
    technicianId: formData.get('technicianId'),
    crewId: formData.get('crewId'),
    assetId: formData.get('assetId'),
    clientId: formData.get('clientId'),
    meetingUrl: formData.get('meetingUrl'),
  })
}

function toData(input: ReturnType<typeof assignmentInputSchema.parse>) {
  return {
    title: input.title,
    description: input.description,
    start: new Date(input.start),
    end: new Date(input.end),
    status: input.status,
    technicianId: input.technicianId ?? null,
    crewId: input.crewId ?? null,
    assetId: input.assetId ?? null,
    clientId: input.clientId ?? null,
    meetingUrl: input.meetingUrl ?? null,
  }
}

// Inline client creation from the assignment form (admin can add a missing client).
export async function createClientInline(
  name: string,
  rut?: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const actor = await requireActor()
  const trimmed = name.trim()
  if (!trimmed) return { error: 'El nombre del cliente es obligatorio.' }
  const client = await prisma.client.create({
    data: { name: trimmed, rut: rut?.trim() || null, tenantId: actor.tenantId },
  })
  revalidatePath('/recursos/cronograma')
  return { id: client.id, name: client.name }
}

export async function createAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  await prisma.assignment.create({ data: { ...toData(parsed.data), tenantId: actor.tenantId } })
  revalidatePath('/recursos/cronograma')
  redirect('/recursos/cronograma')
}

export async function updateAssignment(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const existing = await prisma.assignment.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  await prisma.assignment.update({ where: { id }, data: toData(parsed.data) })
  revalidatePath('/recursos/cronograma')
  redirect('/recursos/cronograma')
}

export async function deleteAssignment(id: string): Promise<void> {
  const actor = await requireActor()
  const existing = await prisma.assignment.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.assignment.delete({ where: { id } })
  revalidatePath('/recursos/cronograma')
}
