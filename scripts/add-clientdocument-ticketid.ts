/**
 * P1-3 (G2) — Agrega ClientDocument.ticketId de forma ADDITIVA (sin rebuild de tabla).
 * SQLite soporta ALTER TABLE ADD COLUMN con REFERENCES sin reescribir la tabla
 * (no valida FK de filas existentes al agregar la columna). Idempotente.
 *
 * Run: npx tsx --env-file=.env[.production.local] scripts/add-clientdocument-ticketid.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let exists = true
  try { await db.execute('SELECT ticketId FROM client_documents LIMIT 1') } catch { exists = false }

  if (exists) {
    console.log('✓ client_documents.ticketId ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE client_documents ADD COLUMN ticketId TEXT REFERENCES tickets(id) ON DELETE SET NULL')
    await db.execute('CREATE INDEX IF NOT EXISTS client_documents_ticketId_idx ON client_documents(ticketId)')
    await db.execute('SELECT ticketId FROM client_documents LIMIT 1') // verificación
    console.log('✓ Columna client_documents.ticketId agregada (ADDITIVA) + índice creado, verificado.')
  }
  const n = await db.execute('SELECT COUNT(*) as c FROM client_documents')
  console.log(`   client_documents en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
