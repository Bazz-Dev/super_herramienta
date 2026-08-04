/**
 * Crea la tabla audit_logs (auditoría transversal, punto #32B) — CREATE TABLE
 * puro, sin tocar tablas existentes. IF NOT EXISTS en tabla e índices (mismo
 * criterio que add-secrets-vault.ts/add-job-installments.ts — evita que una
 * interrupción entre CREATE TABLE y sus CREATE INDEX deje un índice
 * permanentemente faltante en un reintento).
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-audit-log.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  await db.execute(`CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "reason" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`)
  await db.execute('CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt")')
  await db.execute('CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId")')
  await db.execute('CREATE INDEX IF NOT EXISTS "audit_logs_actorId_idx" ON "audit_logs"("actorId")')
  console.log('✓ Tabla audit_logs lista (creada o ya existente), con índices.')

  const n = await db.execute('SELECT COUNT(*) as c FROM tenants')
  console.log(`   tenants en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
