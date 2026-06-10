import { PrismaClient } from '@/generated/prisma/client'
import { createPrismaAdapter } from '@/lib/db-adapter'

// Prisma 7 uses driver adapters. The adapter is chosen from DATABASE_URL:
// better-sqlite3 for a local file (dev/tests), libSQL for Turso (serverless).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  return new PrismaClient({ adapter: createPrismaAdapter() })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
