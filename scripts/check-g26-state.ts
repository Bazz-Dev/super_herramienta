/**
 * G26 — Read-only: verifica si las columnas de las 2 migraciones rebuild
 * pendientes (upgrade → jobs.originTicketId FK, add_session_version →
 * users.sessionVersion) ya están presentes en prod vía scripts additivos,
 * y si la constraint FK real de jobs.originTicketId existe.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/check-g26-state.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  const jobsCols = await db.execute(`PRAGMA table_info(jobs)`)
  const hasOriginTicketId = jobsCols.rows.some(r => r['name'] === 'originTicketId')
  console.log(`jobs.originTicketId columna existe: ${hasOriginTicketId}`)

  const jobsFks = await db.execute(`PRAGMA foreign_key_list(jobs)`)
  const hasOriginTicketFk = jobsFks.rows.some(r => r['from'] === 'originTicketId')
  console.log(`jobs.originTicketId FK constraint existe: ${hasOriginTicketFk}`)
  console.log(`  FKs actuales en jobs:`, jobsFks.rows.map(r => `${r['from']} -> ${r['table']}.${r['to']}`))

  const usersCols = await db.execute(`PRAGMA table_info(users)`)
  const hasSessionVersion = usersCols.rows.some(r => r['name'] === 'sessionVersion')
  console.log(`\nusers.sessionVersion columna existe: ${hasSessionVersion}`)

  const applied = await db.execute(`SELECT migration_name FROM _applied_migrations ORDER BY applied_at`)
  console.log(`\n_applied_migrations (${applied.rows.length}):`)
  for (const r of applied.rows) console.log(`  - ${r['migration_name']}`)

  // Orphan check: jobs.originTicketId pointing to a ticket that no longer exists
  const orphans = await db.execute(`
    SELECT j.id, j.originTicketId FROM jobs j
    WHERE j.originTicketId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = j.originTicketId)
  `)
  console.log(`\nJobs con originTicketId huérfano (ticket ya no existe): ${orphans.rows.length}`)
  for (const r of orphans.rows) console.log(`  - job ${r['id']} -> ticket ${r['originTicketId']} (no existe)`)

  await db.close()
}
main()
