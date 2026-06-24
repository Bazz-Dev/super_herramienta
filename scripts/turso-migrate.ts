/**
 * Applies all pending migrations to Turso (production) and runs the seed.
 * Run with: dotenv -e .env.production.local -- npx tsx scripts/turso-migrate.ts
 * Or:       DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/turso-migrate.ts
 */
import { config } from 'dotenv'
// Load production env if DATABASE_URL not already set (allows direct `npx tsx` invocation)
if (!process.env.DATABASE_URL) {
  config({ path: '.env.production.local' })
}
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !url.startsWith('libsql://')) {
  console.error('❌  DATABASE_URL must be a libsql:// URL. Are you loading .env.production.local?')
  process.exit(1)
}

const client = createClient({ url, authToken })

// Check existing tables
const tableResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
const existing = new Set(tableResult.rows.map((r) => String(r[0])))
console.log('📋 Existing tables:', [...existing].join(', ') || '(none)')

// Read and split migrations
const migrations = [
  '20260609175152_init',
  '20260610003228_add_resources',
  '20260610013459_resources_v2',
  '20260610104529_recursos_v3',
  '20260620022941_cashflow_module',
  '20260623001007_cashflow_table_naming_and_restrict',
  '20260624034801_technicians_contracts_vehicle_expiry_docs',
]

for (const name of migrations) {
  const sqlPath = join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  // Split on statement-level delimiters, skip empty lines
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  console.log(`\n⚙️  Applying ${name} (${statements.length} statements)…`)

  for (const stmt of statements) {
    try {
      await client.execute(stmt + ';')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Skip "already exists" errors — idempotent re-run
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate column') ||
        msg.includes('no such table') && stmt.includes('DROP TABLE')
      ) {
        process.stdout.write('.')
      } else {
        console.warn(`  ⚠  Skipped statement (${msg.slice(0, 80)}):`)
      }
    }
  }
  console.log(' ✓')
}

// Verify
const after = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
console.log('\n✅ Tables after migration:', after.rows.map((r) => String(r[0])).join(', '))

await client.close()
console.log('\nDone. Now run: dotenv -e .env.production.local -- npx tsx prisma/seed.ts')
