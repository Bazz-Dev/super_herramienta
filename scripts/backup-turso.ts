/**
 * Backup lógico completo de la DB (Turso o local) vía @libsql/client — sin CLI.
 * Genera backup-<fecha>.sql con CREATE TABLE/INDEX + INSERTs, restaurable con
 * cualquier cliente SQLite/libSQL.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/backup-turso.ts
 */
import { createClient } from '@libsql/client'
import { writeFileSync } from 'node:fs'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  if (v instanceof ArrayBuffer) return `X'${Buffer.from(v).toString('hex')}'`
  if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const outFile = `backup-${stamp}.sql`

  const master = await db.execute(
    `SELECT name, type, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'
     ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`
  )

  const lines: string[] = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;']
  let totalRows = 0
  const tableCounts: string[] = []

  for (const obj of master.rows) {
    const name = String(obj['name'])
    const type = String(obj['type'])
    lines.push(`${String(obj['sql'])};`)
    if (type !== 'table') continue

    const data = await db.execute(`SELECT * FROM "${name}"`)
    for (const row of data.rows) {
      const cols = data.columns.map(c => `"${c}"`).join(', ')
      const vals = data.columns.map(c => sqlValue((row as Record<string, unknown>)[c])).join(', ')
      lines.push(`INSERT INTO "${name}" (${cols}) VALUES (${vals});`)
    }
    totalRows += data.rows.length
    tableCounts.push(`   ${name}: ${data.rows.length} filas`)
  }

  lines.push('COMMIT;', 'PRAGMA foreign_keys=ON;')
  writeFileSync(outFile, lines.join('\n'))

  console.log(`✓ Backup escrito: ${outFile}`)
  console.log(tableCounts.join('\n'))
  console.log(`   TOTAL: ${totalRows} filas, ${(lines.join('\n').length / 1024).toFixed(0)} KB`)
  // Verificación mínima de integridad del dump
  const txt = lines.join('\n')
  if (!txt.includes('CREATE TABLE') || !txt.toLowerCase().includes('tickets')) {
    console.error('⚠ El dump no contiene la tabla tickets — REVISAR antes de continuar.')
    process.exitCode = 1
  }
  await db.close()
}
main()
