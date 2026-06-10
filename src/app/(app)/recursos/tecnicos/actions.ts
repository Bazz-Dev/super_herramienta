'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/resources/actor'
import { technicianInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parse(formData: FormData) {
  return technicianInputSchema.safeParse({
    name: formData.get('name'),
    rut: formData.get('rut'),
    specialty: formData.get('specialty'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    vehiclePlate: formData.get('vehiclePlate'),
    active: formData.get('active') === 'on',
    notes: formData.get('notes'),
  })
}

export async function createTechnician(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const parsed = parse(formData)
  if (!parsed.success) {
    return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  await prisma.technician.create({ data: { ...parsed.data, tenantId: actor.tenantId } })
  revalidatePath('/recursos/tecnicos')
  redirect('/recursos/tecnicos')
}

export async function updateTechnician(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireActor()
  const existing = await prisma.technician.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) {
    return { error: 'No encontrado o sin permiso.' }
  }
  const parsed = parse(formData)
  if (!parsed.success) {
    return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  await prisma.technician.update({ where: { id }, data: parsed.data })
  revalidatePath('/recursos/tecnicos')
  redirect('/recursos/tecnicos')
}

export async function deleteTechnician(id: string): Promise<void> {
  const actor = await requireActor()
  const existing = await prisma.technician.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.technician.delete({ where: { id } })
  revalidatePath('/recursos/tecnicos')
}
