/**
 * Post-PITR recovery bootstrap.
 *
 * After restoring Turso from PITR, the `_applied_migrations` table won't exist
 * and all migrations look "pending" — including DROP TABLE statements that would
 * destroy data again.
 *
 * This script creates `_applied_migrations` and marks all migrations as applied
 * WITHOUT executing any SQL. After running this, `db:migrate:prod` safely applies
 * only truly-new migrations.
 *
 * Run: npm run db:migrate:bootstrap
 */
import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !url.startsWith('libsql://')) {
  console.error('❌  DATABASE_URL must be a libsql:// URL.')
  console.error('    Got:', url ?? '(undefined)')
  console.error('    Run with: tsx --env-file=.env.production.local scripts/turso-migrate-bootstrap.ts')
  process.exit(1)
}

const client = createClient({ url, authToken })

// All migrations that existed before today's incident — these are marked as
// applied without re-running any SQL.
const KNOWN_APPLIED = [
  '20260609175152_init',
  '20260610003228_add_resources',
  '20260610013459_resources_v2',
  '20260610104529_recursos_v3',
  '20260620022941_cashflow_module',
  '20260623001007_cashflow_table_naming_and_restrict',
  '20260624034801_technicians_contracts_vehicle_expiry_docs',
  '20260624120000_clientops_tickets_portal',
  '20260627021940_technicians_terminated_status',
  '20260629162516_expenses_and_technician_role',
  '20260629162705_add_tecnico_role',
  '20260629173303_fix_expense_cascade_and_assignment_relation',
  '20260629213328_soft_delete_ticket_and_expiry_cron',
  '20260629220000_username_login_indexes_fk_fixes',
  '20260630033400_rename_drive_folder_url_to_folder_key',
  '20260630122118_assignment_ticket_link',
]

console.log('\n🔧 Bootstrap: marcando migraciones previas como aplicadas (sin ejecutarlas)')
console.log('   Esto es seguro — NO corre ningún SQL contra la DB.\n')

await client.execute(`
  CREATE TABLE IF NOT EXISTS _applied_migrations (
    migration_name TEXT NOT NULL PRIMARY KEY,
    applied_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

const existing = await client.execute('SELECT migration_name FROM _applied_migrations')
const already = new Set(existing.rows.map((r) => String(r[0])))

let marked = 0
for (const name of KNOWN_APPLIED) {
  if (already.has(name)) {
    console.log(`   ✓ (ya existe) ${name}`)
    continue
  }
  await client.execute({
    sql: 'INSERT OR IGNORE INTO _applied_migrations (migration_name) VALUES (?)',
    args: [name],
  })
  console.log(`   ✅ Marcado: ${name}`)
  marked++
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
)
console.log(`\n📊 Tablas actuales en Turso: ${tables.rows.map((r) => String(r[0])).join(', ')}`)
console.log(`\n✅ Bootstrap completo. ${marked} migraciones nuevas marcadas.`)
console.log('   Ahora corre: npm run db:migrate:prod')
console.log('   Solo aplicará las migraciones pendientes (nuevas tablas, sin DROP TABLE).\n')

await client.close()
