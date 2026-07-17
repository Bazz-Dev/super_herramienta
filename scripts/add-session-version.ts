/**
 * G20/G26 — Agrega users.sessionVersion de forma ADDITIVA (sin rebuild de tabla).
 * Idempotente: si la columna ya existe, no hace nada.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-session-version.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let exists = true
  try { await db.execute('SELECT sessionVersion FROM users LIMIT 1') } catch { exists = false }

  if (exists) {
    console.log('✓ users.sessionVersion ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE users ADD COLUMN sessionVersion INTEGER NOT NULL DEFAULT 0')
    await db.execute('SELECT sessionVersion FROM users LIMIT 1') // verificación
    console.log('✓ Columna users.sessionVersion agregada (ADDITIVA, default 0) y verificada.')
  }
  const n = await db.execute('SELECT COUNT(*) as c FROM users')
  console.log(`   users en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
