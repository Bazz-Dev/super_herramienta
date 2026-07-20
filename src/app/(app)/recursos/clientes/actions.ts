'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { clientInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'
import { generatePassword } from '@/lib/password'

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
    hasPortal: formData.get('hasPortal') === 'on',
    portalSlug: formData.get('portalSlug'),
    portalColor: formData.get('portalColor'),
  })
}

export async function createClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActor(['super', 'supervisor'])
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const { ruts, hasPortal, portalSlug, portalColor, ...clientData } = parsed.data
  if (hasPortal && portalSlug) {
    const slugTaken = await prisma.client.findUnique({ where: { portalSlug }, select: { id: true } })
    if (slugTaken) return { error: 'Ese slug de portal ya está en uso.', fieldErrors: { portalSlug: ['Slug duplicado'] } }
  }
  const client = await prisma.client.create({
    data: {
      ...clientData,
      tenantId: actor.tenantId,
      portalSlug: hasPortal ? portalSlug : undefined,
      portalTheme: hasPortal ? JSON.stringify({ primary: portalColor || '#d42030' }) : undefined,
    },
  })
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
  const existing = await prisma.client.findUnique({ where: { id }, select: { tenantId: true, portalSlug: true } })
  if (!existing || !canAccessTenant(actor, existing.tenantId)) return { error: 'No encontrado o sin permiso.' }
  const parsed = parse(formData)
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }
  const { ruts, hasPortal, portalSlug, portalColor, ...clientData } = parsed.data
  // Slug ya activo: se mantiene fijo (el form lo envía readOnly, pero se
  // ignora cualquier intento de cambiarlo server-side también).
  const finalSlug = existing.portalSlug ?? (hasPortal ? portalSlug : undefined)
  if (!existing.portalSlug && hasPortal && portalSlug) {
    const slugTaken = await prisma.client.findFirst({ where: { portalSlug, id: { not: id } }, select: { id: true } })
    if (slugTaken) return { error: 'Ese slug de portal ya está en uso.', fieldErrors: { portalSlug: ['Slug duplicado'] } }
  }
  await prisma.client.update({
    where: { id },
    data: {
      ...clientData,
      portalSlug: finalSlug,
      portalTheme: hasPortal ? JSON.stringify({ primary: portalColor || '#d42030' }) : undefined,
    },
  })
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

// ── Usuarios autorizados del portal ─────────────────────────────────────────
// Igual que las cuentas de técnico: emitir/resetear credenciales queda
// restringido a super (decisión del dueño), aunque el resto del CRUD de
// clientes (incl. activar el portal en sí) sigue siendo super+supervisor.

const createPortalUserSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  username: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números, _ . -').optional().or(z.literal('')),
  branchId: z.string().optional().or(z.literal('')),
  isClientAdmin: z.boolean().default(false),
})

export type PortalUserFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: { email: string; username: string | null; password: string }
}

export async function createPortalUser(
  clientId: string,
  _prev: PortalUserFormState,
  formData: FormData,
): Promise<PortalUserFormState> {
  const actor = await requireActor(['super'])
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { tenantId: true, portalSlug: true },
  })
  if (!client || !canAccessTenant(actor, client.tenantId)) return { error: 'No encontrado o sin permiso.' }
  if (!client.portalSlug) return { error: 'Este cliente no tiene portal activo.' }

  const parsed = createPortalUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    username: formData.get('username') || undefined,
    branchId: formData.get('branchId') || undefined,
    isClientAdmin: formData.get('isClientAdmin') === 'on',
  })
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }

  const username = parsed.data.username || null
  const branchId = parsed.data.branchId || null
  if (branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: branchId, clientId }, select: { id: true } })
    if (!branch) return { error: 'Sucursal no válida.' }
  }

  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }),
    username ? prisma.user.findUnique({ where: { username }, select: { id: true } }) : Promise.resolve(null),
  ])
  if (emailTaken) return { error: 'Ese email ya está en uso.', fieldErrors: { email: ['Email duplicado'] } }
  if (usernameTaken) return { error: 'Ese nombre de usuario ya está en uso.', fieldErrors: { username: ['Usuario duplicado'] } }

  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: {
      email: parsed.data.email,
      username,
      name: parsed.data.name,
      passwordHash,
      role: 'client',
      tenantId: client.tenantId,
      clientId,
      branchId,
      isClientAdmin: parsed.data.isClientAdmin,
    },
  })
  revalidatePath(`/recursos/clientes/${clientId}`)
  return { success: { email: parsed.data.email, username, password } }
}

export async function resetPortalUserPassword(userId: string): Promise<{ password: string } | { error: string }> {
  const actor = await requireActor(['super'])
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, role: true, clientId: true },
  })
  if (!user || user.role !== 'client' || !canAccessTenant(actor, user.tenantId)) {
    return { error: 'No encontrado o sin permiso.' }
  }
  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  })
  if (user.clientId) revalidatePath(`/recursos/clientes/${user.clientId}`)
  return { password }
}

export async function togglePortalUserActive(userId: string, active: boolean): Promise<void> {
  const actor = await requireActor(['super'])
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, role: true, clientId: true },
  })
  if (!user || user.role !== 'client' || !canAccessTenant(actor, user.tenantId)) return
  await prisma.user.update({
    where: { id: userId },
    data: { active, sessionVersion: { increment: 1 } },
  })
  if (user.clientId) revalidatePath(`/recursos/clientes/${user.clientId}`)
}
