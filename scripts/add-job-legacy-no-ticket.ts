/**
 * Agrega Job.legacyNoTicket de forma ADDITIVA (ALTER TABLE ADD COLUMN — la
 * migración local de Prisma hizo un rebuild de tabla, como siempre en SQLite
 * con `prisma migrate dev`; mismo patrón ya establecido en add-expense-paidat.ts/
 * add-job-origin-proposal.ts para no repetir el riesgo de G26 contra Turso:
 * un rebuild interrumpido en prod puede perder la tabla completa). Default
 * `false` para todas las filas existentes — no cambia ningún dato, solo deja
 * disponible el campo para que el triage de /conciliacion lo use desde cero.
 * Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-job-legacy-no-ticket.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let exists = true
  try { await db.execute('SELECT legacyNoTicket FROM jobs LIMIT 1') } catch { exists = false }

  if (exists) {
    console.log('✓ jobs.legacyNoTicket ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE jobs ADD COLUMN legacyNoTicket BOOLEAN NOT NULL DEFAULT false')
    await db.execute('SELECT legacyNoTicket FROM jobs LIMIT 1') // verificación
    console.log('✓ Columna jobs.legacyNoTicket agregada (ADDITIVA), verificado.')
  }
  const n = await db.execute('SELECT COUNT(*) as c FROM jobs')
  console.log(`   jobs en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
