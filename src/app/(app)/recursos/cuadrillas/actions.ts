'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/resources/actor'
import { crewInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant, tenantScope, type TenantActor } from '@/lib/tenant'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parse(formData: FormData) {
  return crewInputSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    active: formData.get('active') === 'on',
    technicianIds: formData.getAll('technicianIds').map(String),
  })
}

// Keep only technician ids that belong to the actor's tenant.
async function safeTechIds(actor: TenantActor, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const rows = await prisma.technician.findMany({
    where: { id: { in: ids }, ...tenantScope(actor) },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

export async function createCrew(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const techIds = await safeTechIds(actor, parsed.data.technicianIds)
  await prisma.crew.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      active: parsed.data.active,
      tenantId: actor.tenantId,
      technicians: { connect: techIds.map((id) => ({ id })) },
    },
  })
  revalidatePath('/recursos/cuadrillas')
  redirect('/recursos/cuadrillas')
}

export async function updateCrew(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor()
  const existing = await prisma.crew.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const techIds = await safeTechIds(actor, parsed.data.technicianIds)
  await prisma.crew.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      active: parsed.data.active,
      technicians: { set: techIds.map((tid) => ({ id: tid })) },
    },
  })
  revalidatePath('/recursos/cuadrillas')
  redirect('/recursos/cuadrillas')
}

export async function deleteCrew(id: string): Promise<void> {
  const actor = await requireActor()
  const existing = await prisma.crew.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return
  await prisma.crew.delete({ where: { id } })
  revalidatePath('/recursos/cuadrillas')
}
