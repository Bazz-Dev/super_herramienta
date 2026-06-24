import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@/generated/prisma/enums'

// Edge-safe config: NO database / bcrypt imports here so it can be used by
// middleware (which runs on the Edge runtime). The Credentials provider with
// its Node-only `authorize` lives in auth.ts.
const PROTECTED_PREFIXES = ['/dashboard']

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [], // populated in auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isProtected = PROTECTED_PREFIXES.some((p) => nextUrl.pathname.startsWith(p))

      if (isProtected) return isLoggedIn

      // Already logged in and visiting /login → bounce to dashboard.
      if (isLoggedIn && nextUrl.pathname === '/login') {
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
