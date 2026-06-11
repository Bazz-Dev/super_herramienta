// Checks the admin credential directly against the configured DB (Turso).
//   npx tsx scripts/check-login.ts
import { config } from 'dotenv'
config({ path: '.env.production.local' })

import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'

const EMAIL = 'admin@ingegarchile.cl'
const PASSWORD = 'ingegar123'

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const r = await client.execute({
  sql: 'SELECT id, email, active, passwordHash FROM users WHERE email = ?',
  args: [EMAIL],
})

if (r.rows.length === 0) {
  console.log('❌ El usuario', EMAIL, 'NO existe en la base de producción.')
} else {
  const u = r.rows[0] as unknown as { email: string; active: number; passwordHash: string }
  const match = await bcrypt.compare(PASSWORD, u.passwordHash)
  console.log('Usuario:', u.email)
  console.log('Activo:', u.active ? 'sí' : 'NO')
  console.log('Hash presente:', u.passwordHash ? `sí (${u.passwordHash.slice(0, 7)}…, len ${u.passwordHash.length})` : 'NO')
  console.log('Password "ingegar123" valida:', match ? '✅ SÍ' : '❌ NO')
}
client.close()
