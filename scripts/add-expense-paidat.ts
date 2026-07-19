/**
 * Agrega Expense.paidAt de forma ADDITIVA (ALTER TABLE ADD COLUMN — no rebuild
 * de tabla, no toca filas existentes). También agrega el valor 'pagado' al
 * enum ExpenseStatus — como SQLite no tiene tipo enum nativo, Prisma lo
 * modela como TEXT sin CHECK constraint aquí, así que ese cambio no requiere
 * ninguna migración de DB, solo el Prisma Client regenerado. Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-expense-paidat.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let exists = true
  try { await db.execute('SELECT paidAt FROM expenses LIMIT 1') } catch { exists = false }

  if (exists) {
    console.log('✓ expenses.paidAt ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE expenses ADD COLUMN paidAt DATETIME')
    await db.execute('SELECT paidAt FROM expenses LIMIT 1') // verificación
    console.log('✓ Columna expenses.paidAt agregada (ADDITIVA), verificado.')
  }
  const n = await db.execute('SELECT COUNT(*) as c FROM expenses')
  console.log(`   expenses en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
