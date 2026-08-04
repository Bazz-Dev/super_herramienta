/**
 * Agrega Ticket.processFlow (informe #2 — modalidad PP/ED) de forma ADDITIVA.
 * Nullable, sin default: los tickets históricos no expresaron esta decisión y
 * no se les asigna un valor inventado. Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-ticket-process-flow.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let exists = true
  try { await db.execute('SELECT processFlow FROM tickets LIMIT 1') } catch { exists = false }

  if (exists) {
    console.log('✓ tickets.processFlow ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE tickets ADD COLUMN processFlow TEXT')
    await db.execute('SELECT processFlow FROM tickets LIMIT 1') // verificación
    console.log('✓ Columna tickets.processFlow agregada (ADDITIVA), verificado.')
  }
  const n = await db.execute('SELECT COUNT(*) as c FROM tickets')
  console.log(`   tickets en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
