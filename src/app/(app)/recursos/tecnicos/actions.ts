'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { technicianInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'
import { fromDateInput } from '@/lib/cashflow/dates'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parse(formData: FormData) {
  return technicianInputSchema.safeParse({
    name: formData.get('name'),
    rut: formData.get('rut'),
    specialty: formData.get('specialty'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    active: formData.get('active') === 'on',
    notes: formData.get('notes'),
    contractType: formData.get('contractType'),
    contractEndDate: formData.get('contractEndDate'),
    dailyRate: formData.get('dailyRate'),
    birthDate: formData.get('birthDate'),
    emergencyContact: formData.get('emergencyContact'),
    emergencyPhone: formData.get('emergencyPhone'),
  })
}

function techData(p: ReturnType<typeof technicianInputSchema.parse>) {
  return {
    ...p,
    contractEndDate: fromDateInput(p.contractEndDate),
    birthDate: fromDateInput(p.birthDate),
  }
}

export async function createTechnician(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const parsed = parse(formData)
  if (!parsed.success) {
    return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  await prisma.technician.create({ data: { ...techData(parsed.data), tenantId: actor.tenantId } })
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
  await prisma.technician.update({ where: { id }, data: techData(parsed.data) })
  revalidatePath('/recursos/tecnicos')
  revalidatePath(`/recursos/tecnicos/${id}`)
  redirect(`/recursos/tecnicos/${id}`)
}

export async function deleteDocument(docId: string, techId: string): Promise<void> {
  const actor = await requireActor()
  const doc = await prisma.technicianDocument.findFirst({
    where: { id: docId, technician: { tenantId: actor.tenantId } },
    select: { id: true, fileUrl: true },
  })
  if (!doc) return
  await prisma.technicianDocument.delete({ where: { id: docId } })
  if (!doc.fileUrl.startsWith('/') && !doc.fileUrl.startsWith('http')) {
    const { deleteFromR2 } = await import('@/lib/r2')
    await deleteFromR2(doc.fileUrl).catch(() => null)
  }
  revalidatePath(`/recursos/tecnicos/${techId}`)
}

export async function deleteTechnician(id: string): Promise<void> {
  const actor = await requireActor()
  const existing = await prisma.technician.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.technician.delete({ where: { id } })
  revalidatePath('/recursos/tecnicos')
}
