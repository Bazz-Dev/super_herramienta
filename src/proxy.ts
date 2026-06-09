import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

// Next.js 16 renamed the "middleware" convention to "proxy" and requires a
// direct function export. Auth.js' `auth` handler doubles as the proxy.
// Uses the edge-safe config only (no bcrypt / Prisma).
const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  // Run on everything except static assets, image optimizer and the auth API.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
