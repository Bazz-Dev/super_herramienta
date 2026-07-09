import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@/generated/prisma/enums'

// Edge-safe config: NO database / bcrypt imports here.
// Internal app routes — require authentication AND role !== 'client' AND role !== 'tecnico'
const INTERNAL_PREFIXES = [
  '/dashboard', '/tickets', '/flujo', '/cronograma',
  '/recursos', '/cotizador', '/informe', '/gastos',
]
// Tecnico panel — only accessible to tecnico role
const TECNICO_PREFIX = '/mi-panel'
// Portal routes — require authentication AND role === 'client'
const PORTAL_PREFIX = '/portal'

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 días
  trustHost: true,
  providers: [], // populated in auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const role = auth?.user?.role as string | undefined
      const path = nextUrl.pathname

      const isInternal = INTERNAL_PREFIXES.some((p) => path.startsWith(p))
      const isTecnicoPanel = path.startsWith(TECNICO_PREFIX)
      const isPortal   = path.startsWith(PORTAL_PREFIX)

      // Internal routes: must be logged in + not a client + not a tecnico
      if (isInternal) {
        if (!isLoggedIn) return Response.redirect(new URL('/login', nextUrl))
        if (role === 'client') {
          return Response.redirect(new URL('/login', nextUrl))
        }
        if (role === 'tecnico') {
          return Response.redirect(new URL('/mi-panel', nextUrl))
        }
        return true
      }

      // Tecnico panel: must be logged in as tecnico
      if (isTecnicoPanel) {
        if (!isLoggedIn) return Response.redirect(new URL('/login', nextUrl))
        if (role !== 'tecnico') return Response.redirect(new URL('/dashboard', nextUrl))
        return true
      }

      // Portal login page: if already logged in as client, let through
      // (portal sub-pages handle their own auth)
      if (isPortal) return true

      // /login: logged-in users → their home; clients → login (portal)
      if (isLoggedIn && path === '/login') {
        if (role === 'client') return true // portal login handles it
        if (role === 'tecnico') return Response.redirect(new URL('/mi-panel', nextUrl))
        return Response.redirect(new URL('/dashboard', nextUrl))
      }

      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.tenantId = user.tenantId
        token.tenantSlug = user.tenantSlug
        token.clientId = user.clientId ?? null
        token.technicianId = user.technicianId ?? null
        token.branchId = user.branchId ?? null
        token.isClientAdmin = user.isClientAdmin ?? false
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string
        session.user.role = token.role as Role
        session.user.tenantId = token.tenantId as string
        session.user.tenantSlug = token.tenantSlug as string
        session.user.clientId = (token.clientId as string | null | undefined) ?? null
        session.user.technicianId = (token.technicianId as string | null | undefined) ?? null
        session.user.branchId = (token.branchId as string | null | undefined) ?? null
        session.user.isClientAdmin = (token.isClientAdmin as boolean | undefined) ?? false
      }
      return session
    },
  },
} satisfies NextAuthConfig
