'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { clientInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

function parse(formData: FormData) {
  let ruts: { rut: string; label?: string }[] = []
  try { ruts = JSON.parse(formData.get('ruts') as string ?? '[]') } catch { ruts = [] }
  return clientInputSchema.safeParse({
    name: formData.get('name'),
    rut: formData.get('rut'),
    label: formData.get('label') || undefined,
    contact: formData.get('contact'),
    email: formData.get('email'),
    ruts,
  })
}

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const { ruts, ...clientData } = parsed.data
  const client = await prisma.client.create({ data: { ...clientData, tenantId: actor.tenantId } })
  if (ruts.length) {
    await prisma.clientRut.createMany({
      data: ruts.map((r) => ({ clientId: client.id, rut: r.rut, label: r.label ?? null })),
    })
  }
  revalidatePath('/recursos/clientes')
  redirect('/recursos/clientes')
}

export async function updateClient(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.client.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const { ruts, ...clientData } = parsed.data
  await prisma.client.update({ where: { id }, data: clientData })
  // Replace all RUTs (delete old, insert new)
  await prisma.clientRut.deleteMany({ where: { clientId: id } })
  if (ruts.length) {
    await prisma.clientRut.createMany({
      data: ruts.map((r) => ({ clientId: id, rut: r.rut, label: r.label ?? null })),
    })
  }
  revalidatePath('/recursos/clientes')
  redirect('/recursos/clientes')
}

export async function createBranch(clientId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.client.findUnique({ where: { id: clientId }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const name = (formData.get('name') as string)?.trim()
  const city = (formData.get('city') as string)?.trim() || null
  if (!name) return { error: 'El nombre de la sucursal es obligatorio.' }
  try {
    await prisma.branch.create({ data: { tenantId: existing.tenantId, clientId, name, city: city ?? undefined } })
  } catch {
    return { error: 'Ya existe una sucursal con ese nombre para este cliente.' }
  }
  revalidatePath(`/recursos/clientes/${clientId}`)
  return {}
}

export async function toggleBranch(branchId: string, active: boolean): Promise<void> {
  const actor = await requireActor(['super', 'supervisor'])
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { tenantId: true, clientId: true } })
  if (!branch || !canAccessTenant(actor, branch.tenantId)) return
  await prisma.branch.update({ where: { id: branchId }, data: { active } })
  revalidatePath(`/recursos/clientes/${branch.clientId}`)
}

export async function saveClientLogo(id: string, dataUrl: string | null): Promise<{ error?: string }> {
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.client.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'Sin permiso.' }
  // Validate: must be a data URI image or null
  if (dataUrl !== null && !dataUrl.startsWith('data:image/')) return { error: 'Formato de imagen inválido.' }
  await prisma.client.update({ where: { id }, data: { logoUrl: dataUrl } })
  revalidatePath(`/recursos/clientes/${id}`)
  return {}
}

export async function deleteClient(id: string): Promise<{ error?: string }> {
  const actor = await requireActor(['super', 'supervisor'])
  const existing = await prisma.client.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }

  // Branch/Job/Ticket son onDelete:Restrict (tirarían un 500 crudo de Prisma);
  // ClientDocument es onDelete:Cascade (borraría cotizaciones/informes en
  // silencio). Se verifican los 4 antes de intentar borrar (G35).
  const [branches, jobs, tickets, documents] = await Promise.all([
    prisma.branch.count({ where: { clientId: id } }),
    prisma.job.count({ where: { clientId: id } }),
    prisma.ticket.count({ where: { clientId: id } }),
    prisma.clientDocument.count({ where: { clientId: id } }),
  ])
  if (branches || jobs || tickets || documents) {
    const parts: string[] = []
    if (branches) parts.push(`${branches} sucursal(es)`)
    if (jobs) parts.push(`${jobs} trabajo(s)`)
    if (tickets) parts.push(`${tickets} ticket(s)`)
    if (documents) parts.push(`${documents} documento(s) guardado(s)`)
    return { error: `No se puede eliminar: tiene ${parts.join(', ')} asociados.` }
  }

  await prisma.client.delete({ where: { id } })
  revalidatePath('/recursos/clientes')
  return {}
}

// Inline client creation from the assignment form (admin can add a missing client
// without leaving the cronograma). Returns the new client or an error.
export async function createClientInline(
  name: string,
  rut?: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const actor = await requireActor(['super', 'supervisor'])
  const trimmed = name.trim()
  if (!trimmed) return { error: 'El nombre del cliente es obligatorio.' }
  const client = await prisma.client.create({
    data: { name: trimmed, rut: rut?.trim() || null, tenantId: actor.tenantId },
  })
  revalidatePath('/recursos/clientes')
  revalidatePath('/cronograma')
  return { id: client.id, name: client.name }
}
