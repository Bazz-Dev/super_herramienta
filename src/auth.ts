import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authConfig } from '@/auth.config'

// Accepts an email address OR a username (no @ required)
const credentialsSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        login: { label: 'Usuario o Email', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const { login, password } = parsed.data
        const isEmail = login.includes('@')

        const user = await prisma.user.findFirst({
          where: isEmail ? { email: login } : { username: login },
          include: { tenant: true },
        })
        if (!user || !user.active) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          clientId: user.clientId ?? null,
          technicianId: user.technicianId ?? null,
        }
      },
    }),
  ],
})
