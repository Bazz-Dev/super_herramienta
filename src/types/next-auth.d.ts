import type { Role } from '@/generated/prisma/enums'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    role: Role
    tenantId: string
    tenantSlug: string
  }

  interface Session {
    user: {
      id: string
      role: Role
      tenantId: string
      tenantSlug: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role
    tenantId: string
    tenantSlug: string
  }
}
