/**
 * G32/P1-8 — Agrega constraints únicos (tenantId, rut) en technicians y
 * (tenantId, plate) en vehicles, para prevenir duplicados como el caso
 * previo de "Juan Jesús Díaz" duplicado. Puramente additivo (CREATE UNIQUE
 * INDEX), sin rebuild de tabla — seguro para aplicar directo a Turso.
 *
 * Verificado antes de escribir este script: 0 duplicados en prod (ver
 * scripts/check-duplicate-rut-plate.ts). Si en el futuro ya existieran
 * duplicados, este script fallaría con un error claro de SQLite en vez
 * de corromper datos — nunca borra ni fusiona filas.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-unique-rut-plate.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function indexExists(name: string): Promise<boolean> {
  const res = await db.execute({
    sql: `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
    args: [name],
  })
  return res.rows.length > 0
}

async function main() {
  if (await indexExists('technicians_tenantId_rut_key')) {
    console.log('✓ technicians_tenantId_rut_key ya existe, sin cambios.')
  } else {
    await db.execute(`CREATE UNIQUE INDEX "technicians_tenantId_rut_key" ON "technicians"("tenantId", "rut")`)
    console.log('✓ technicians_tenantId_rut_key creado.')
  }

  if (await indexExists('vehicles_tenantId_plate_key')) {
    console.log('✓ vehicles_tenantId_plate_key ya existe, sin cambios.')
  } else {
    await db.execute(`CREATE UNIQUE INDEX "vehicles_tenantId_plate_key" ON "vehicles"("tenantId", "plate")`)
    console.log('✓ vehicles_tenantId_plate_key creado.')
  }

  await db.close()
}
main()
