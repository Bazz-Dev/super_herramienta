'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { assetInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parse(formData: FormData) {
  return assetInputSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code'),
    category: formData.get('category'),
    status: formData.get('status'),
    vehicleId: formData.get('vehicleId'),
    notes: formData.get('notes'),
  })
}

export async function createAsset(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const { vehicleId, ...rest } = parsed.data
  await prisma.asset.create({ data: { ...rest, vehicleId: vehicleId ?? null, tenantId: actor.tenantId } })
  revalidatePath('/recursos/activos')
  redirect('/recursos/activos')
}

export async function updateAsset(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const existing = await prisma.asset.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const { vehicleId, ...rest } = parsed.data
  await prisma.asset.update({ where: { id }, data: { ...rest, vehicleId: vehicleId ?? null } })
  revalidatePath('/recursos/activos')
  redirect('/recursos/activos')
}

export async function deleteAsset(id: string): Promise<void> {
  const actor = await requireActor()
  const existing = await prisma.asset.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.asset.delete({ where: { id } })
  revalidatePath('/recursos/activos')
}
