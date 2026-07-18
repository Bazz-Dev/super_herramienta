'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { technicianInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'
import { fromDateInput } from '@/lib/cashflow/dates'
import { CONTRACT_TYPE_TERMINATED } from '@/lib/resources/labels'

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
    phone2: formData.get('phone2'),
    mutualidad: formData.get('mutualidad'),
  })
}

function techData(p: ReturnType<typeof technicianInputSchema.parse>) {
  return {
    ...p,
    // El form ya envía active=false para tipos desvinculados (technician-form.tsx),
    // pero se re-fuerza aquí server-side — es la única función que ambas server
    // actions usan para construir el data, así que una invocación directa (sin
    // pasar por ese form) no puede dejar a un técnico despedido con active:true (G36).
    active: CONTRACT_TYPE_TERMINATED.includes(p.contractType) ? false : p.active,
    contractEndDate: fromDateInput(p.contractEndDate),
    birthDate: fromDateInput(p.birthDate),
  }
}

async function rutTaken(tenantId: string, rut: string | undefined, excludeId?: string): Promise<boolean> {
  if (!rut) return false
  const dup = await prisma.technician.findFirst({
    where: { tenantId, rut, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  })
  return !!dup
}

export async function createTechnician(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const parsed = parse(formData)
  if (!parsed.success) {
    return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  if (await rutTaken(actor.tenantId, parsed.data.rut)) {
    return { error: 'Ya existe un técnico con ese RUT.', fieldErrors: { rut: ['RUT duplicado'] } }
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
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.technician.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) {
    return { error: 'No encontrado o sin permiso.' }
  }
  const parsed = parse(formData)
  if (!parsed.success) {
    return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  }
  if (await rutTaken(actor.tenantId, parsed.data.rut, id)) {
    return { error: 'Ya existe otro técnico con ese RUT.', fieldErrors: { rut: ['RUT duplicado'] } }
  }
  await prisma.technician.update({ where: { id }, data: techData(parsed.data) })
  revalidatePath('/recursos/tecnicos')
  revalidatePath(`/recursos/tecnicos/${id}`)
  redirect(`/recursos/tecnicos/${id}`)
}

export async function deleteDocument(docId: string, techId: string): Promise<void> {
  const actor = await requireActor(['super', 'supervisor'])
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

// Deliberately no hard-delete action for técnicos — they carry payroll,
// signed FES documents and leave history that Cascade-deletes with the
// record (labor-law retention risk). Desvinculación uses contractType
// (no_renovado/despedido), never a DB delete. See G32.
