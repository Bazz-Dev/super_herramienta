import type { Role } from '@/generated/prisma/enums'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    role: Role
    tenantId: string
    tenantSlug: string
    clientId?: string | null
    technicianId?: string | null
    branchId?: string | null
    isClientAdmin?: boolean
    sessionVersion?: number
  }

  interface Session {
    user: {
      id: string
      role: Role
      tenantId: string
      tenantSlug: string
      clientId?: string | null
      technicianId?: string | null
      branchId?: string | null
      isClientAdmin?: boolean
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role
    tenantId: string
    tenantSlug: string
    clientId?: string | null
    technicianId?: string | null
    branchId?: string | null
    isClientAdmin?: boolean
    sv?: number // sessionVersion al momento de emitir el token (revocación G20)
  }
}
