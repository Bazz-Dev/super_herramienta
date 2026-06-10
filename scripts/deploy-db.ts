// One-shot Turso bootstrap + seed.
// Reads DATABASE_URL + TURSO_AUTH_TOKEN from .env.production.local (gitignored),
// applies the full schema (scripts/turso-bootstrap.sql) via @libsql/client, then
// runs the normal seed (which inherits the libSQL DATABASE_URL from this process).
//
//   npx tsx scripts/deploy-db.ts
import { config } from 'dotenv'
config({ path: '.env.production.local' })

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !/^libsql:\/\//.test(url)) {
  throw new Error('DATABASE_URL debe ser una URL libsql:// (revisa .env.production.local).')
}

async function main() {
  const client = createClient({ url: url!, authToken })

  // Is the schema already there? (idempotent re-runs)
  const existing = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
  )
  if (existing.rows.length === 0) {
    console.log('Aplicando esquema a Turso…')
    const sql = readFileSync('scripts/turso-bootstrap.sql', 'utf8')
    await client.executeMultiple(sql)
    console.log('Esquema aplicado.')
  } else {
    console.log('El esquema ya existe en Turso (omito bootstrap).')
  }
  client.close()

  console.log('Sembrando datos en Turso…')
  // The child process inherits process.env (DATABASE_URL=libsql, TURSO_AUTH_TOKEN),
  // so seed.ts targets Turso. seed.ts's own dotenv('.env') does not override these.
  execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env: process.env })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
