import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// Pick the Prisma driver adapter from the connection URL so the same code runs
// locally and on serverless:
//   - libsql:// or http(s):// (Turso)  → libSQL adapter (+ TURSO_AUTH_TOKEN)
//   - file:                            → better-sqlite3 (native, used in dev/tests)
export function createPrismaAdapter() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  if (/^(libsql|https?|wss?):\/\//.test(url)) {
    return new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  }
  return new PrismaBetterSqlite3({ url })
}
