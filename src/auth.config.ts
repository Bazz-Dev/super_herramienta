import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@/generated/prisma/enums'

// Edge-safe config: NO database / bcrypt imports here.
// Internal app routes — require authentication AND role !== 'client'
const INTERNAL_PREFIXES = [
  '/dashboard', '/tickets', '/flujo', '/cronograma',
  '/recursos', '/cotizador', '/informe',
]
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
      const isPortal   = path.startsWith(PORTAL_PREFIX)

      // Internal routes: must be logged in + not a client
      if (isInternal) {
        if (!isLoggedIn) return Response.redirect(new URL('/login', nextUrl))
        if (role === 'client') {
          // Redirect clients to their portal; clientId not available in edge
          // so we send them to /login which will redirect appropriately
          return Response.redirect(new URL('/login', nextUrl))
        }
        return true
      }

      // Portal login page: if already logged in as client, let through
      // (portal sub-pages handle their own auth)
      if (isPortal) return true

      // /login: logged-in internal users → dashboard; clients → login (portal)
      if (isLoggedIn && path === '/login') {
        if (role === 'client') return true // portal login handles it
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
      }
      return session
    },
  },
} satisfies NextAuthConfig
