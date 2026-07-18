/**
 * G26 — Cierre de la decisión: NO se aplican las migraciones rebuild
 * (20260714211121_upgrade, 20260717012444_add_session_version) contra Turso.
 * Sus columnas (jobs.originTicketId, users.sessionVersion) ya están vivas en
 * prod vía scripts additivos (add-job-origin-ticket manual + add-session-version.ts).
 * Lo único que aportarían esas migraciones es la constraint FK real de
 * jobs.originTicketId → tickets.id, que hoy ya se valida a nivel de app en
 * createJob() y tiene 0 huérfanos verificados (ver check-g26-state.ts).
 *
 * Este script solo deja constancia en _applied_migrations para que la
 * tabla de tracking sea honesta — turso-migrate.ts NUNCA las tiene en su
 * array de migraciones candidatas, así que esto es documentación, no una
 * medida de seguridad adicional.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/mark-g26-migrations-resolved.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

const RESOLVED = [
  '20260714211121_upgrade',
  '20260717012444_add_session_version',
]

async function main() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS _applied_migrations (
      migration_name TEXT NOT NULL PRIMARY KEY,
      applied_at     TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  for (const name of RESOLVED) {
    const existing = await db.execute({
      sql: `SELECT migration_name FROM _applied_migrations WHERE migration_name = ?`,
      args: [name],
    })
    if (existing.rows.length > 0) {
      console.log(`✓ ${name} ya estaba marcada.`)
      continue
    }
    // Nombre EXACTO (no decorado) — así si algún día se agrega a la
    // migrations[] de turso-migrate.ts, applied.has(m) la reconoce y la
    // salta en vez de reintentar el rebuild.
    await db.execute({
      sql: `INSERT INTO _applied_migrations (migration_name, applied_at) VALUES (?, datetime('now'))`,
      args: [name],
    })
    console.log(`✓ ${name} marcada como resuelta (G26 — columna ya vive vía script additivo).`)
  }

  await db.close()
}
main()
