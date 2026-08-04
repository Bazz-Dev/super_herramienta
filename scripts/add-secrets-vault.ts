/**
 * Crea las tablas secrets/secret_reveals (bóveda de credenciales, punto #21
 * del informe) — ambas CREATE TABLE puro, sin tocar tablas existentes.
 * IF NOT EXISTS en cada statement (tabla e índice) en vez de un chequeo
 * previo + rama condicional: así una interrupción entre CREATE TABLE y su
 * CREATE INDEX no deja el índice permanentemente faltante en un reintento
 * (el chequeo condicional solo miraba si la tabla existía, no el índice).
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-secrets-vault.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  await db.execute(`CREATE TABLE IF NOT EXISTS "secrets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "url" TEXT,
    "username" TEXT,
    "notes" TEXT,
    "ciphertext" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "secrets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "secrets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`)
  await db.execute('CREATE INDEX IF NOT EXISTS "secrets_tenantId_idx" ON "secrets"("tenantId")')
  console.log('✓ Tabla secrets lista (creada o ya existente), con índice.')

  await db.execute(`CREATE TABLE IF NOT EXISTS "secret_reveals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secretId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revealedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "secret_reveals_secretId_fkey" FOREIGN KEY ("secretId") REFERENCES "secrets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "secret_reveals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`)
  await db.execute('CREATE INDEX IF NOT EXISTS "secret_reveals_secretId_idx" ON "secret_reveals"("secretId")')
  console.log('✓ Tabla secret_reveals lista (creada o ya existente), con índice.')

  const n = await db.execute('SELECT COUNT(*) as c FROM tenants')
  console.log(`   tenants en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
