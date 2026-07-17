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
          branchId: user.branchId ?? null,
          isClientAdmin: user.isClientAdmin ?? false,
          sessionVersion: user.sessionVersion ?? 0,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Revocación por usuario (G20): el middleware edge no puede consultar la DB,
    // pero toda página/route/action usa este auth() de Node — aquí sí se revoca.
    // Incrementar users.sessionVersion invalida los JWT emitidos antes.
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.tenantId = user.tenantId
        token.tenantSlug = user.tenantSlug
        token.clientId = user.clientId ?? null
        token.technicianId = user.technicianId ?? null
        token.branchId = user.branchId ?? null
        token.isClientAdmin = user.isClientAdmin ?? false
        token.sv = user.sessionVersion ?? 0
        return token
      }
      if (token.sub) {
        const u = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { sessionVersion: true, active: true },
        })
        const tokenSv = typeof token.sv === 'number' ? token.sv : 0
        if (!u || !u.active || (u.sessionVersion ?? 0) > tokenSv) return null
      }
      return token
    },
  },
})
