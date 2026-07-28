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
import { readFileSync, readdirSync } from 'node:fs'
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

// Se leen las carpetas de prisma/migrations/ en vez de mantener una lista a
// mano — la lista hardcodeada que vivía acá se quedó desactualizada 8
// migraciones atrás sin que nada lo marcara como error (el script solo
// decía "0 pendientes" y se veía exitoso). Con esto, cualquier migración
// nueva se detecta automáticamente por el simple hecho de tener su carpeta
// en el repo — no hay un segundo lugar que actualizar y olvidar.
const migrationsDir = join(process.cwd(), 'prisma', 'migrations')
const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'migration_lock.toml')
  .map((e) => e.name)
  .sort() // los nombres empiezan con timestamp YYYYMMDDHHMMSS — el orden alfabético es el orden cronológico

const pending = migrations.filter((m) => !applied.has(m))
console.log(`\n⏳ Migraciones pendientes: ${pending.length}`)
if (pending.length === 0) {
  console.log('   ✅ Base de datos ya está al día. Nada que aplicar.')
  await client.close()
  process.exit(0)
}

// Guardrail añadido tras un incidente evitado a mano: si el ledger queda
// desactualizado (una migración se aplicó por otra vía sin quedar
// registrada), este script la vuelve a ver como "pendiente". El patrón
// RedefineTables de SQLite (CREATE new_X -> INSERT SELECT -> DROP X ->
// RENAME) es catastrófico en ese escenario — recrea la tabla con SOLO las
// columnas que esa migración vieja conocía, perdiendo en silencio
// cualquier columna agregada por migraciones posteriores que sí se
// aplicaron. Antes de ejecutar cualquier RedefineTables, se compara contra
// el schema real: si la tabla viva tiene columnas que la migración no
// conoce, se aborta en vez de destruir datos.
function extractRedefineTargets(sql: string): { liveTable: string; columns: string[] }[] {
  const results: { liveTable: string; columns: string[] }[] = []
  const createRe = /CREATE TABLE "(new_[a-zA-Z0-9_]+)" \(([\s\S]*?)\n\);/g
  let m: RegExpExecArray | null
  while ((m = createRe.exec(sql))) {
    const liveTable = m[1].replace(/^new_/, '')
    const columns: string[] = []
    for (const rawLine of m[2].split(',\n')) {
      const line = rawLine.trim()
      if (!line || /^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE)\b/i.test(line)) continue
      const colMatch = line.match(/^"([a-zA-Z0-9_]+)"/)
      if (colMatch) columns.push(colMatch[1])
    }
    results.push({ liveTable, columns })
  }
  return results
}

async function assertRedefineSafe(name: string, sql: string) {
  for (const { liveTable, columns } of extractRedefineTargets(sql)) {
    const info = await client.execute(`PRAGMA table_info("${liveTable}")`).catch(() => null)
    if (!info || info.rows.length === 0) continue // la tabla no existe aún — nada que perder
    const liveColumns = info.rows.map((r) => String(r.name))
    const missing = liveColumns.filter((c) => !columns.includes(c))
    if (missing.length > 0) {
      throw new Error(
        `La migración "${name}" reconstruye "${liveTable}" (RedefineTables de SQLite) pero el schema real ya tiene ` +
        `columnas que esta migración no conoce y destruiría: ${missing.join(', ')}. Esto indica un ledger ` +
        `_applied_migrations desactualizado (la migración ya se aplicó antes por otra vía) — no se ejecuta.`
      )
    }
  }
}

for (const name of pending) {
  process.stdout.write(`\n⚙️  Aplicando ${name} … `)

  const sqlPath = join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql')
  const sql = readFileSync(sqlPath, 'utf8')

  try {
    await assertRedefineSafe(name, sql)
  } catch (err) {
    console.error(`\n🛑 ${err instanceof Error ? err.message : String(err)}`)
    await client.close()
    process.exit(1)
  }

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
