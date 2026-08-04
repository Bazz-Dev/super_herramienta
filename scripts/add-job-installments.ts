/**
 * Agrega Job.installmentsPlanned (ALTER TABLE ADD COLUMN puro, sin rebuild
 * esta vez — SQLite lo permitió directo por ser una sola columna nullable) y
 * crea la tabla nueva job_installments. Ambos additivos, ninguno toca datos
 * existentes. Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-job-installments.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let hasColumn = true
  try { await db.execute('SELECT installmentsPlanned FROM jobs LIMIT 1') } catch { hasColumn = false }
  if (hasColumn) {
    console.log('✓ jobs.installmentsPlanned ya existe.')
  } else {
    await db.execute('ALTER TABLE jobs ADD COLUMN installmentsPlanned INTEGER')
    console.log('✓ Columna jobs.installmentsPlanned agregada (ADDITIVA).')
  }

  // CREATE TABLE/INDEX con IF NOT EXISTS (no chequeo-condicional): así una
  // interrupción entre ambos statements no deja el índice permanentemente
  // faltante en un reintento — ver mismo criterio en add-secrets-vault.ts.
  await db.execute(`CREATE TABLE IF NOT EXISTS "job_installments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "netAmount" INTEGER,
    "purchaseOrder" TEXT,
    "purchaseOrderDate" DATETIME,
    "purchaseOrderFileUrl" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" DATETIME,
    "invoiceFileUrl" TEXT,
    "creditDays" INTEGER,
    "paymentDate" DATETIME,
    "paymentAmount" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "job_installments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "job_installments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`)
  await db.execute('CREATE INDEX IF NOT EXISTS "job_installments_jobId_idx" ON "job_installments"("jobId")')
  console.log('✓ Tabla job_installments lista (creada o ya existente), con índice.')

  const n = await db.execute('SELECT COUNT(*) as c FROM jobs')
  console.log(`   jobs en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
