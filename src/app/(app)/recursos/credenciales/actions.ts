'use server'

import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'
import { encryptSecret, decryptSecret } from '@/lib/secrets/crypto'
import { logAudit } from '@/lib/audit'

export type FormState = { error?: string; fieldErrors?: Record<string, string[]> }

const secretSchema = z.object({
  serviceName: z.string().min(1, 'El nombre del servicio es obligatorio'),
  url: z.string().optional(),
  username: z.string().optional(),
  notes: z.string().optional(),
  secretValue: z.string().min(1, 'El secreto es obligatorio'),
})

// Bóveda: solo super, y nunca bajo "ver como" — mismo criterio que las
// acciones identity-bound de RR.HH. (G32): revelar/crear/rotar una
// credencial empresarial real no debe quedar disponible mientras se
// impersona a otro usuario.
async function requireVaultActor() {
  const actor = await requireActor(['super'])
  if (actor.viewingAsName) throw new Error('Salí de "ver como" antes de gestionar la bóveda de credenciales.')
  return actor
}

export async function createSecret(_: unknown, formData: FormData): Promise<FormState> {
  const actor = await requireVaultActor()
  const parsed = secretSchema.safeParse({
    serviceName: formData.get('serviceName'),
    url: formData.get('url') || undefined,
    username: formData.get('username') || undefined,
    notes: formData.get('notes') || undefined,
    secretValue: formData.get('secretValue'),
  })
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }

  const created = await prisma.secret.create({
    data: {
      tenantId: actor.tenantId,
      serviceName: parsed.data.serviceName,
      url: parsed.data.url ?? null,
      username: parsed.data.username ?? null,
      notes: parsed.data.notes ?? null,
      ciphertext: encryptSecret(parsed.data.secretValue),
      createdById: actor.id,
    },
  })
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'secret.create', entityType: 'Secret', entityId: created.id,
    after: { serviceName: parsed.data.serviceName, url: parsed.data.url ?? null, username: parsed.data.username ?? null },
    source: 'recursos/credenciales/actions.ts:createSecret',
  })
  revalidatePath('/recursos/credenciales')
  return {}
}

const updateMetaSchema = secretSchema.omit({ secretValue: true }).extend({ secretValue: z.string().optional() })

export async function updateSecret(id: string, _: unknown, formData: FormData): Promise<FormState> {
  const actor = await requireVaultActor()
  const existing = await prisma.secret.findFirst({ where: { id, tenantId: actor.tenantId }, select: { id: true, serviceName: true, url: true, username: true } })
  if (!existing) return { error: 'Credencial no encontrada.' }

  const parsed = updateMetaSchema.safeParse({
    serviceName: formData.get('serviceName'),
    url: formData.get('url') || undefined,
    username: formData.get('username') || undefined,
    notes: formData.get('notes') || undefined,
    secretValue: formData.get('secretValue') || undefined,
  })
  if (!parsed.success) return { error: 'Revisa los campos.', fieldErrors: parsed.error.flatten().fieldErrors }

  const rotated = !!parsed.data.secretValue
  await prisma.secret.update({
    where: { id },
    data: {
      serviceName: parsed.data.serviceName,
      url: parsed.data.url ?? null,
      username: parsed.data.username ?? null,
      notes: parsed.data.notes ?? null,
      // Rotar el secreto es opcional al editar — no forzar a reescribirlo
      // solo para corregir el nombre del servicio o una nota.
      ...(rotated ? { ciphertext: encryptSecret(parsed.data.secretValue!) } : {}),
    },
  })
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'secret.update', entityType: 'Secret', entityId: id,
    before: { serviceName: existing.serviceName, url: existing.url, username: existing.username },
    after: { serviceName: parsed.data.serviceName, url: parsed.data.url ?? null, username: parsed.data.username ?? null, secretRotated: rotated },
    source: 'recursos/credenciales/actions.ts:updateSecret',
  })
  revalidatePath('/recursos/credenciales')
  return {}
}

export async function deleteSecret(id: string): Promise<{ error?: string }> {
  const actor = await requireVaultActor()
  const existing = await prisma.secret.findFirst({ where: { id, tenantId: actor.tenantId }, select: { id: true, serviceName: true } })
  if (!existing) return { error: 'Credencial no encontrada.' }
  await prisma.secret.delete({ where: { id } })
  await logAudit({
    tenantId: actor.tenantId, actorId: actor.id, actorRole: actor.role,
    action: 'secret.delete', entityType: 'Secret', entityId: id,
    before: { serviceName: existing.serviceName },
    source: 'recursos/credenciales/actions.ts:deleteSecret',
  })
  revalidatePath('/recursos/credenciales')
  return {}
}

// Reautenticación (informe #21: "MFA o reautenticación para revelar") — pide
// la password del propio usuario logueado, no la del secreto. Cada reveal
// queda auditado en SecretReveal (nunca se guarda el valor revelado).
export async function revealSecret(id: string, currentPassword: string): Promise<{ value?: string; error?: string }> {
  const actor = await requireVaultActor()
  const [secret, user] = await Promise.all([
    prisma.secret.findFirst({ where: { id, tenantId: actor.tenantId }, select: { ciphertext: true } }),
    prisma.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } }),
  ])
  if (!secret || !user) return { error: 'Credencial no encontrada.' }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) return { error: 'Contraseña incorrecta.' }

  await prisma.secretReveal.create({ data: { secretId: id, userId: actor.id } })
  return { value: decryptSecret(secret.ciphertext) }
}
