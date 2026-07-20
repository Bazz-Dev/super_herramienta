'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { technicianInputSchema } from '@/lib/resources/schemas'
import { canAccessTenant } from '@/lib/tenant'
import { fromDateInput } from '@/lib/cashflow/dates'
import { CONTRACT_TYPE_TERMINATED } from '@/lib/resources/labels'
import { generatePassword } from '@/lib/password'

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

// ── Cuenta de acceso (login) del técnico ────────────────────────────────────
// Emitir/resetear credenciales queda restringido a super (decisión del
// dueño) — más sensible que el resto del CRUD de técnicos, que sigue siendo
// super+supervisor.

const createAccountSchema = z.object({
  email: z.string().email('Email inválido'),
  username: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números, _ . -').optional().or(z.literal('')),
})

export type AccountFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: { email: string; username: string | null; password: string }
}

export async function createTechnicianAccount(
  technicianId: string,
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const actor = await requireActor(['super'])
  const tech = await prisma.technician.findUnique({
    where: { id: technicianId },
    select: { name: true, tenantId: true },
  })
  if (!tech || !canAccessTenant(actor, tech.tenantId)) return { error: 'No encontrado o sin permiso.' }

  const existing = await prisma.user.findUnique({ where: { technicianId }, select: { id: true } })
  if (existing) return { error: 'Este técnico ya tiene una cuenta.' }

  const parsed = createAccountSchema.safeParse({
    email: formData.get('email'),
    username: formData.get('username') || undefined,
  })
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }

  const username = parsed.data.username || null
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
      name: tech.name,
      passwordHash,
      role: 'tecnico',
      tenantId: tech.tenantId,
      technicianId,
    },
  })
  revalidatePath(`/recursos/tecnicos/${technicianId}`)
  return { success: { email: parsed.data.email, username, password } }
}

export async function resetTechnicianPassword(userId: string): Promise<{ password: string } | { error: string }> {
  const actor = await requireActor(['super'])
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, role: true, technicianId: true },
  })
  if (!user || user.role !== 'tecnico' || !canAccessTenant(actor, user.tenantId)) {
    return { error: 'No encontrado o sin permiso.' }
  }
  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  })
  if (user.technicianId) revalidatePath(`/recursos/tecnicos/${user.technicianId}`)
  return { password }
}

export async function toggleTechnicianAccountActive(userId: string, active: boolean): Promise<void> {
  const actor = await requireActor(['super'])
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, role: true, technicianId: true },
  })
  if (!user || user.role !== 'tecnico' || !canAccessTenant(actor, user.tenantId)) return
  await prisma.user.update({
    where: { id: userId },
    data: { active, sessionVersion: { increment: 1 } },
  })
  if (user.technicianId) revalidatePath(`/recursos/tecnicos/${user.technicianId}`)
}
