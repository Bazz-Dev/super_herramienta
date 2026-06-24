/**
 * Applies all Prisma migrations to Turso (production).
 * Run via: npm run db:migrate:prod
 * tsx --env-file=.env.production.local loads the correct DATABASE_URL automatically.
 */
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !url.startsWith('libsql://')) {
  console.error('❌  DATABASE_URL must be a libsql:// URL.')
  console.error('    Got:', url ?? '(undefined)')
  process.exit(1)
}

const client = createClient({ url, authToken })

const tableResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
const existing = new Set(tableResult.rows.map((r) => String(r[0])))
console.log('📋 Tablas existentes:', [...existing].join(', ') || '(ninguna)')

const migrations = [
  '20260609175152_init',
  '20260610003228_add_resources',
  '20260610013459_resources_v2',
  '20260610104529_recursos_v3',
  '20260620022941_cashflow_module',
  '20260623001007_cashflow_table_naming_and_restrict',
  '20260624034801_technicians_contracts_vehicle_expiry_docs',
  '20260624120000_clientops_tickets_portal',
]

for (const name of migrations) {
  const sqlPath = join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  process.stdout.write(`⚙️  ${name} … `)

  for (const stmt of statements) {
    try {
      await client.execute(stmt + ';')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        (msg.includes('no such table') && stmt.includes('DROP TABLE'))
      ) {
        // idempotente — tabla/columna ya existe
      } else {
        console.warn(`\n  ⚠  ${msg.slice(0, 100)}`)
      }
    }
  }
  console.log('✓')
}

const after = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
console.log('\n✅ Tablas tras migración:', after.rows.map((r) => String(r[0])).join(', '))

await client.close()
