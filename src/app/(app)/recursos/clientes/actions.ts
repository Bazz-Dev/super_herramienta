'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/resources/actor'
import { clientInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parse(formData: FormData) {
  return clientInputSchema.safeParse({
    name: formData.get('name'),
    rut: formData.get('rut'),
    contact: formData.get('contact'),
    email: formData.get('email'),
  })
}

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  await prisma.client.create({ data: { ...parsed.data, tenantId: actor.tenantId } })
  revalidatePath('/recursos/clientes')
  redirect('/recursos/clientes')
}

export async function updateClient(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const existing = await prisma.client.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  await prisma.client.update({ where: { id }, data: parsed.data })
  revalidatePath('/recursos/clientes')
  redirect('/recursos/clientes')
}

export async function deleteClient(id: string): Promise<void> {
  const actor = await requireActor()
  const existing = await prisma.client.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.client.delete({ where: { id } })
  revalidatePath('/recursos/clientes')
}

// Inline client creation from the assignment form (admin can add a missing client
// without leaving the cronograma). Returns the new client or an error.
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
  revalidatePath('/recursos/clientes')
  revalidatePath('/cronograma')
  return { id: client.id, name: client.name }
}
