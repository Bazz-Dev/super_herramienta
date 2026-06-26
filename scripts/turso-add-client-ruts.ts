// Add ClientRut table + label column to Client in Turso production DB
import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.production.local') })

const db = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const SQL = [
  `ALTER TABLE clients ADD COLUMN label TEXT`,
  `CREATE TABLE IF NOT EXISTS client_ruts (
    id TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    rut TEXT NOT NULL,
    label TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_client_ruts_client ON client_ruts (clientId)`,
]

for (const sql of SQL) {
  try {
    await db.execute(sql)
    console.log('✓', sql.slice(0, 70).replace(/\s+/g, ' '))
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log('⏭  already exists:', sql.slice(0, 50).replace(/\s+/g, ' '))
    } else {
      throw e
    }
  }
}
console.log('\n✅ client_ruts table + clients.label ready in Turso')
await db.close()
