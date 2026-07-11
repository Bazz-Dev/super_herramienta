/**
 * Applies pending Prisma migrations to Turso (production).
 * Run via: npm run db:migrate:prod
 *
 * SAFE BY DESIGN:
 * - Tracks applied migrations in `_applied_migrations` table (like Prisma does).
 * - Skips migrations already applied — never re-runs DROP TABLE on live data.
 * - Prints a clear summary of what was applied vs skipped.
 */
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !url.startsWith('libsql://')) {
  console.error('❌  DATABASE_URL must be a libsql:// URL.')
  console.error('    Got:', url ?? '(undefined)')
  console.error('    Run with: tsx --env-file=.env.production.local scripts/turso-migrate.ts')
  process.exit(1)
}

const client = createClient({ url, authToken })

// Create migration tracking table (idempotent)
await client.execute(`
  CREATE TABLE IF NOT EXISTS _applied_migrations (
    migration_name TEXT NOT NULL PRIMARY KEY,
    applied_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

// Load already-applied migrations
const appliedResult = await client.execute('SELECT migration_name FROM _applied_migrations ORDER BY applied_at')
const applied = new Set(appliedResult.rows.map((r) => String(r[0])))
console.log(`\n📋 Migraciones ya aplicadas: ${applied.size}`)
if (applied.size > 0) {
  for (const m of applied) console.log(`   ✓ ${m}`)
}

const migrations = [
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
  '20260630214131_client_documents_and_fes',
  '20260630222439_add_data_json_to_client_documents',
  '20260630223147_rrhh_module',
  '20260706041156_add_client_logo_url',
  '20260709150320_add_technician_mutualidad_phone2',
  '20260709215827_add_branch_client_admin_approval_status',
]

const pending = migrations.filter((m) => !applied.has(m))
console.log(`\n⏳ Migraciones pendientes: ${pending.length}`)
if (pending.length === 0) {
  console.log('   ✅ Base de datos ya está al día. Nada que aplicar.')
  await client.close()
  process.exit(0)
}

for (const name of pending) {
  process.stdout.write(`\n⚙️  Aplicando ${name} … `)

  const sqlPath = join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  // Split on semicolon+newline, strip leading comment lines from each block
  const statements = sql
    .split(/;\s*\n/)
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter((s) => s.length > 0)

  let failed = false
  for (const stmt of statements) {
    try {
      await client.execute(stmt + ';')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Truly idempotent: only skip errors that mean "already done"
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate column name') ||
        (msg.includes('no such table') && stmt.toUpperCase().trimStart().startsWith('DROP TABLE'))
      ) {
        // harmless — already applied
      } else {
        console.error(`\n   ❌ Error en statement:\n   ${stmt.slice(0, 120)}\n   → ${msg}`)
        failed = true
        break
      }
    }
  }

  if (failed) {
    console.error(`\n🛑 Migración ${name} falló. Abortando para no corromper la DB.`)
    await client.close()
    process.exit(1)
  }

  // Mark as applied ONLY after all statements succeeded
  await client.execute({
    sql: 'INSERT OR IGNORE INTO _applied_migrations (migration_name) VALUES (?)',
    args: [name],
  })
  console.log('✓')
}

console.log('\n✅ Todas las migraciones pendientes aplicadas correctamente.')

const after = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
console.log('📊 Tablas en producción:', after.rows.map((r) => String(r[0])).join(', '))

await client.close()
