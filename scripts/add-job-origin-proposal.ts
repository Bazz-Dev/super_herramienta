/**
 * G37 — Agrega Job.originProposalId de forma ADDITIVA (sin rebuild de tabla).
 * SQLite soporta ALTER TABLE ADD COLUMN con REFERENCES sin reescribir la tabla
 * (no valida FK de filas existentes al agregar la columna). Idempotente.
 *
 * La migración local (20260718230408_add_job_origin_proposal) hace un rebuild
 * completo de "jobs" — NO se aplica tal cual a Turso (ver G26). Este script
 * logra el mismo resultado en prod sin el riesgo de un rebuild interrumpido,
 * y su nombre queda deliberadamente fuera de scripts/turso-migrate.ts.
 *
 * Run: npx tsx --env-file=.env[.production.local] scripts/add-job-origin-proposal.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let exists = true
  try { await db.execute('SELECT originProposalId FROM jobs LIMIT 1') } catch { exists = false }

  if (exists) {
    console.log('✓ jobs.originProposalId ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE jobs ADD COLUMN originProposalId TEXT REFERENCES client_documents(id) ON DELETE SET NULL')
    await db.execute('CREATE INDEX IF NOT EXISTS jobs_originProposalId_idx ON jobs(originProposalId)')
    await db.execute('SELECT originProposalId FROM jobs LIMIT 1') // verificación
    console.log('✓ Columna jobs.originProposalId agregada (ADDITIVA) + índice creado, verificado.')
  }
  const n = await db.execute('SELECT COUNT(*) as c FROM jobs')
  console.log(`   jobs en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
