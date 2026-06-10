import { createRequire } from 'node:module'

// Resolve adapter packages lazily so the unused driver's native binary is never
// loaded. In production (Turso/libSQL) `better-sqlite3` is never required, which
// avoids native-module load failures on serverless.
const require = createRequire(import.meta.url)

// Pick the Prisma driver adapter from the connection URL so the same code runs
// locally and on serverless:
//   - libsql:// or http(s):// (Turso)  → libSQL adapter (+ TURSO_AUTH_TOKEN)
//   - file:                            → better-sqlite3 (native, used in dev/tests)
export function createPrismaAdapter() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'

  if (/^(libsql|https?|wss?):\/\//.test(url)) {
    const { PrismaLibSql } = require('@prisma/adapter-libsql')
    return new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN })
  }

  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
  return new PrismaBetterSqlite3({ url })
}
