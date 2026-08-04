'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generatePassword } from '@/lib/password'
import { logAudit } from '@/lib/audit'

// Todas las actions de este archivo son del admin del cliente (Carolina y
// equivalentes) O de staff INGEGAR viendo/gestionando el portal — staff ya
// tiene acceso completo a esto mismo desde /recursos/clientes/[id]
// (BranchManager/PortalUserManager), así que dejarlo operar también desde
// acá no es una escalada de privilegio nueva. isClientAdmin sigue siendo un
// rol DENTRO del portal del cliente, nunca un puente a INGEGAR One: `role`
// nunca se toca acá (siempre 'client' para lo que crea un admin de cliente).
// targetClientId viene BINDEADO server-side desde la página (resuelto de
// getPortalClientBySlug(slug), nunca de un campo de formulario) — mismo
// nivel de confianza que cualquier :id de ruta ya usado en el resto de la
// app, no un valor que el cliente pueda falsificar para apuntar a otro
// cliente.
//
// staffRoles por acción replica EXACTAMENTE la distinción ya existente en
// recursos/clientes/actions.ts: createBranch/toggleBranch son
// ['super','supervisor'], pero createPortalUser/updatePortalUser/
// resetPortalUserPassword/togglePortalUserActive son ['super'] a secas —
// supervisor gestiona sucursales pero deliberadamente NO cuentas/
// credenciales de usuarios de portal. Un solo isStaff compartido para
// ambos tipos de action hubiera dejado a supervisor crear/promover admins
// de cliente vía este flujo nuevo, algo que el equivalente interno le
// tiene explícitamente prohibido — hallazgo real de differential-review
// antes de este fix.
async function requireClientAdmin(targetClientId: string, staffRoles: Array<'super' | 'supervisor'> = ['super', 'supervisor']) {
  const session = await auth()
  if (!session?.user) return null

  const isStaff = staffRoles.includes(session.user.role as 'super' | 'supervisor')
  const isOwnClientAdmin = session.user.role === 'client' && session.user.isClientAdmin && session.user.clientId === targetClientId
  if (!isStaff && !isOwnClientAdmin) return null

  const client = await prisma.client.findUnique({ where: { id: targetClientId }, select: { portalSlug: true, tenantId: true } })
  if (!client?.portalSlug) return null
  return { tenantId: client.tenantId, clientId: targetClientId, portalSlug: client.portalSlug, actorId: session.user.id, actorRole: session.user.role }
}

export type PortalBranchFormState = { error?: string }

export async function createPortalBranch(clientId: string, _prev: PortalBranchFormState, formData: FormData): Promise<PortalBranchFormState> {
  const actor = await requireClientAdmin(clientId)
  if (!actor?.clientId) return { error: 'No autorizado.' }

  const name = (formData.get('name') as string)?.trim()
  const city = (formData.get('city') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const contactName = (formData.get('contactName') as string)?.trim() || null
  const contactPhone = (formData.get('contactPhone') as string)?.trim() || null
  if (!name) return { error: 'El nombre de la sucursal es obligatorio.' }

  try {
    await prisma.branch.create({
      data: {
        tenantId: actor.tenantId, clientId: actor.clientId, name,
        city: city ?? undefined, address: address ?? undefined,
        contactName: contactName ?? undefined, contactPhone: contactPhone ?? undefined,
      },
    })
  } catch {
    return { error: 'Ya existe una sucursal con ese nombre.' }
  }

  revalidatePath(`/portal/${actor.portalSlug}/sucursales`)
  return {}
}

export async function togglePortalBranchActive(clientId: string, branchId: string, active: boolean): Promise<{ error?: string }> {
  const actor = await requireClientAdmin(clientId)
  if (!actor?.clientId) return { error: 'No autorizado.' }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { clientId: true } })
  if (!branch || branch.clientId !== actor.clientId) return { error: 'Sucursal no encontrada.' }

  await prisma.branch.update({ where: { id: branchId }, data: { active } })
  revalidatePath(`/portal/${actor.portalSlug}/sucursales`)
  return {}
}

const createTeamUserSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  username: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números, _ . -').optional().or(z.literal('')),
  branchId: z.string().optional().or(z.literal('')),
  isClientAdmin: z.boolean().default(false),
})

export type PortalTeamUserFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: { email: string; username: string | null; password: string }
}

export async function createPortalTeamUser(clientId: string, _prev: PortalTeamUserFormState, formData: FormData): Promise<PortalTeamUserFormState> {
  const actor = await requireClientAdmin(clientId, ['super'])
  if (!actor?.clientId) return { error: 'No autorizado.' }

  const parsed = createTeamUserSchema.safeParse({
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
    const branch = await prisma.branch.findFirst({ where: { id: branchId, clientId: actor.clientId }, select: { id: true } })
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
  const created = await prisma.user.create({
    data: {
      email: parsed.data.email, username, name: parsed.data.name, passwordHash,
      role: 'client', tenantId: actor.tenantId, clientId: actor.clientId, branchId,
      isClientAdmin: parsed.data.isClientAdmin,
    },
  })
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.actorId, actorRole: actor.actorRole,
    action: 'user.create', entityType: 'User', entityId: created.id,
    after: { email: parsed.data.email, role: 'client', clientId: actor.clientId, branchId, isClientAdmin: parsed.data.isClientAdmin },
    reason: 'Self-service desde portal cliente',
    source: 'portal/[slug]/sucursales/actions.ts:createPortalTeamUser',
  })
  revalidatePath(`/portal/${actor.portalSlug}/sucursales`)
  return { success: { email: parsed.data.email, username, password } }
}

export async function togglePortalTeamUserActive(clientId: string, userId: string, active: boolean): Promise<{ error?: string }> {
  const actor = await requireClientAdmin(clientId, ['super'])
  if (!actor?.clientId) return { error: 'No autorizado.' }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { clientId: true, role: true, isClientAdmin: true, active: true },
  })
  if (!user || user.role !== 'client' || user.clientId !== actor.clientId) return { error: 'Usuario no encontrado.' }

  // No dejar al cliente sin ningún admin activo — se quedaría sin nadie que
  // apruebe tickets de sucursal ni gestione su propio equipo.
  if (!active && user.isClientAdmin) {
    const otherActiveAdmins = await prisma.user.count({
      where: { clientId: actor.clientId, role: 'client', isClientAdmin: true, active: true, id: { not: userId } },
    })
    if (otherActiveAdmins === 0) return { error: 'No puedes desactivar al único admin activo — quedarían sin nadie que apruebe solicitudes.' }
  }

  await prisma.user.update({ where: { id: userId }, data: { active, sessionVersion: { increment: 1 } } })
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.actorId, actorRole: actor.actorRole,
    action: active ? 'user.activate' : 'user.deactivate', entityType: 'User', entityId: userId,
    before: { active: user.active }, after: { active },
    reason: 'Self-service desde portal cliente',
    source: 'portal/[slug]/sucursales/actions.ts:togglePortalTeamUserActive',
  })
  revalidatePath(`/portal/${actor.portalSlug}/sucursales`)
  return {}
}
