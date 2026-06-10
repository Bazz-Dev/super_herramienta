// Quick read-only sanity check against the configured DB.
//   npx tsx scripts/verify-db.ts
import { config } from 'dotenv'
config({ path: '.env.production.local' })

import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const tables = ['tenants', 'users', 'technicians', 'vehicles', 'assets', 'assignments', 'clients']
for (const t of tables) {
  const r = await client.execute(`SELECT COUNT(*) AS n FROM ${t}`)
  console.log(t.padEnd(14), r.rows[0].n)
}
const admin = await client.execute("SELECT email, role FROM users LIMIT 1")
console.log('admin →', admin.rows[0]?.email, admin.rows[0]?.role)
client.close()
