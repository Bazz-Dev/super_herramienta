/**
 * Read-only: busca RUTs de técnicos duplicados y patentes de vehículos
 * duplicadas en producción, antes de decidir si agregar constraints @@unique.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/check-duplicate-rut-plate.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  const dupRuts = await db.execute(`
    SELECT tenantId, rut, COUNT(*) as n, GROUP_CONCAT(name, ' | ') as names
    FROM technicians
    WHERE rut IS NOT NULL AND rut != ''
    GROUP BY tenantId, rut
    HAVING COUNT(*) > 1
  `)
  console.log(`=== RUTs de técnicos duplicados: ${dupRuts.rows.length} ===`)
  for (const r of dupRuts.rows) console.log(`  rut=${r['rut']} (${r['n']}x): ${r['names']}`)

  const dupPlates = await db.execute(`
    SELECT tenantId, plate, COUNT(*) as n, GROUP_CONCAT(id, ' | ') as ids
    FROM vehicles
    GROUP BY tenantId, plate
    HAVING COUNT(*) > 1
  `)
  console.log(`\n=== Patentes de vehículos duplicadas: ${dupPlates.rows.length} ===`)
  for (const r of dupPlates.rows) console.log(`  plate=${r['plate']} (${r['n']}x): ${r['ids']}`)

  await db.close()
}
main()
