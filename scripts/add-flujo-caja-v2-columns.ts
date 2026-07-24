/**
 * Aplica ADDITIVAMENTE a Turso las columnas nuevas de Job del sub-proyecto 1
 * de la reescritura de Flujo de Caja (ver
 * docs/superpowers/specs/2026-07-24-flujo-caja-job-schema-design.md).
 * Nunca usa la migración de `prisma migrate dev` tal cual (esa hace un
 * rebuild de la tabla completa, seguro en SQLite local pero no es el patrón
 * aprobado para Turso) — son puros ALTER TABLE ADD COLUMN, idempotente
 * (revisa columna por columna antes de agregar), mismo patrón que
 * add-ot-file-and-company-docs.ts / add-job-origin-proposal.ts.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-flujo-caja-v2-columns.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

const COLUMNS: { name: string; ddl: string }[] = [
  { name: 'code', ddl: 'ALTER TABLE jobs ADD COLUMN code TEXT' },
  { name: 'processFlow', ddl: "ALTER TABLE jobs ADD COLUMN processFlow TEXT NOT NULL DEFAULT 'pre_quote'" },
  { name: 'commercialStage', ddl: "ALTER TABLE jobs ADD COLUMN commercialStage TEXT NOT NULL DEFAULT 'intake'" },
  { name: 'operationalStage', ddl: "ALTER TABLE jobs ADD COLUMN operationalStage TEXT NOT NULL DEFAULT 'pending'" },
  { name: 'documentationStage', ddl: "ALTER TABLE jobs ADD COLUMN documentationStage TEXT NOT NULL DEFAULT 'pending'" },
  { name: 'financialStage', ddl: "ALTER TABLE jobs ADD COLUMN financialStage TEXT NOT NULL DEFAULT 'no_po'" },
  { name: 'docOt', ddl: 'ALTER TABLE jobs ADD COLUMN docOt BOOLEAN' },
  { name: 'docPhotos', ddl: 'ALTER TABLE jobs ADD COLUMN docPhotos BOOLEAN' },
  { name: 'docReport', ddl: 'ALTER TABLE jobs ADD COLUMN docReport BOOLEAN' },
  { name: 'docClientSent', ddl: 'ALTER TABLE jobs ADD COLUMN docClientSent BOOLEAN' },
  { name: 'rejectionReason', ddl: 'ALTER TABLE jobs ADD COLUMN rejectionReason TEXT' },
  { name: 'rejectionDate', ddl: 'ALTER TABLE jobs ADD COLUMN rejectionDate DATETIME' },
  { name: 'nonBillable', ddl: 'ALTER TABLE jobs ADD COLUMN nonBillable BOOLEAN NOT NULL DEFAULT false' },
  { name: 'nonBillableReason', ddl: 'ALTER TABLE jobs ADD COLUMN nonBillableReason TEXT' },
  { name: 'lastContactDate', ddl: 'ALTER TABLE jobs ADD COLUMN lastContactDate DATETIME' },
  { name: 'nextContactDate', ddl: 'ALTER TABLE jobs ADD COLUMN nextContactDate DATETIME' },
  { name: 'contactNote', ddl: 'ALTER TABLE jobs ADD COLUMN contactNote TEXT' },
]

const INDEXES: { name: string; ddl: string }[] = [
  { name: 'jobs_code_key', ddl: 'CREATE UNIQUE INDEX IF NOT EXISTS jobs_code_key ON jobs(code)' },
  { name: 'jobs_code_idx', ddl: 'CREATE INDEX IF NOT EXISTS jobs_code_idx ON jobs(code)' },
  { name: 'jobs_processFlow_commercialStage_idx', ddl: 'CREATE INDEX IF NOT EXISTS jobs_processFlow_commercialStage_idx ON jobs(processFlow, commercialStage)' },
  { name: 'jobs_financialStage_idx', ddl: 'CREATE INDEX IF NOT EXISTS jobs_financialStage_idx ON jobs(financialStage)' },
]

async function main() {
  console.log('DB host →', new URL(process.env.DATABASE_URL!).host)

  for (const col of COLUMNS) {
    let exists = true
    try { await db.execute(`SELECT ${col.name} FROM jobs LIMIT 1`) } catch { exists = false }
    if (exists) {
      console.log(`✓ jobs.${col.name} ya existe — nada que hacer.`)
    } else {
      await db.execute(col.ddl)
      await db.execute(`SELECT ${col.name} FROM jobs LIMIT 1`) // verificación
      console.log(`✓ Columna jobs.${col.name} agregada (ADDITIVA), verificado.`)
    }
  }

  for (const idx of INDEXES) {
    await db.execute(idx.ddl)
    console.log(`✓ Índice ${idx.name} asegurado.`)
  }

  const n = await db.execute('SELECT COUNT(*) as c FROM jobs')
  console.log(`   jobs en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
