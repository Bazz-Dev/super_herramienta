'use server'

import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const schema = z.object({
  currentPassword: z.string().min(1, 'Requerido'),
  newPassword:     z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(1, 'Requerido'),
})

export async function changePortalPassword(_: unknown, fd: FormData) {
  const session = await auth()
  if (!session?.user?.id) return { error: 'No autenticado' }

  const parsed = schema.safeParse({
    currentPassword: fd.get('currentPassword'),
    newPassword:     fd.get('newPassword'),
    confirmPassword: fd.get('confirmPassword'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }

  if (parsed.data.newPassword !== parsed.data.confirmPassword)
    return { error: 'Las contraseñas nuevas no coinciden' }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return { error: 'Usuario no encontrado' }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
  if (!valid) return { error: 'Contraseña actual incorrecta' }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  })

  return { success: true }
}
