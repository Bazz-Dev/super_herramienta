/**
 * Agrega Job.legacyReviewedById + Job.legacyReviewedAt de forma ADDITIVA
 * (la migración local hizo rebuild de tabla, como siempre en SQLite — mismo
 * criterio que add-job-legacy-no-ticket.ts para no repetir el riesgo de G26
 * contra Turso). Default NULL para todas las filas existentes. Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-job-legacy-reviewed-by.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let exists = true
  try { await db.execute('SELECT legacyReviewedById FROM jobs LIMIT 1') } catch { exists = false }

  if (exists) {
    console.log('✓ jobs.legacyReviewedById ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE jobs ADD COLUMN legacyReviewedById TEXT')
    await db.execute('ALTER TABLE jobs ADD COLUMN legacyReviewedAt DATETIME')
    await db.execute('SELECT legacyReviewedById, legacyReviewedAt FROM jobs LIMIT 1') // verificación
    console.log('✓ Columnas jobs.legacyReviewedById/legacyReviewedAt agregadas (ADDITIVAS), verificado.')
  }
  const n = await db.execute('SELECT COUNT(*) as c FROM jobs')
  console.log(`   jobs en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
