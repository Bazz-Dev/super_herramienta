'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireActor } from '@/lib/tenant'

const updateProfileSchema = z.object({
  name: z.string().min(2).max(60),
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_.-]+$/, 'Solo letras, números, _ . -').optional().or(z.literal('')),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(1),
})

export async function updateProfile(_: unknown, fd: FormData) {
  const actor = await requireActor()
  const parsed = updateProfileSchema.safeParse({
    name: fd.get('name'),
    username: fd.get('username') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  const username = parsed.data.username || null

  // Check username uniqueness (ignore own record)
  if (username) {
    const conflict = await prisma.user.findFirst({
      where: { username, id: { not: actor.id } },
    })
    if (conflict) return { error: 'Ese nombre de usuario ya está en uso' }
  }

  await prisma.user.update({
    where: { id: actor.id },
    data: { name: parsed.data.name, username },
  })

  revalidatePath('/perfil')
  return { success: true }
}

export async function changePassword(_: unknown, fd: FormData) {
  const actor = await requireActor()
  const parsed = changePasswordSchema.safeParse({
    currentPassword: fd.get('currentPassword'),
    newPassword: fd.get('newPassword'),
    confirmPassword: fd.get('confirmPassword'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { error: 'Las contraseñas nuevas no coinciden' }
  }

  const user = await prisma.user.findUnique({ where: { id: actor.id } })
  if (!user) return { error: 'Usuario no encontrado' }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!valid) return { error: 'Contraseña actual incorrecta' }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10)
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: newHash } })

  return { success: true }
}
