/**
 * Agrega expenses.jobId, expenses.isGeneral y expenses.supplier de forma
 * ADDITIVA (informe #14). La migración local hizo rebuild de tabla (SQLite
 * no puede agregar una columna FK-participante vía ALTER TABLE ADD COLUMN)
 * — mismo criterio ya usado para legacyReviewedById (G47)/originProposalId:
 * contra Turso se agrega SOLO la columna, sin el FK físico, para evitar el
 * riesgo de un rebuild interrumpido contra una base remota (G26). Prisma no
 * necesita el FK físico para la relación — el único código que escribe
 * jobId siempre valida `job.originTicketId === expense.ticketId` primero
 * (ver setExpenseJob en gastos/actions.ts). Todo nullable, sin default —
 * gastos históricos quedan sin estos campos (nunca se infiere jobId ni
 * "general" a la fuerza). Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-expense-job-classification.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let hasCols = true
  try { await db.execute('SELECT jobId, isGeneral, supplier FROM expenses LIMIT 1') } catch { hasCols = false }

  if (hasCols) {
    console.log('✓ expenses.jobId/isGeneral/supplier ya existen — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE expenses ADD COLUMN jobId TEXT')
    await db.execute('ALTER TABLE expenses ADD COLUMN isGeneral BOOLEAN')
    await db.execute('ALTER TABLE expenses ADD COLUMN supplier TEXT')
    await db.execute('SELECT jobId, isGeneral, supplier FROM expenses LIMIT 1') // verificación
    console.log('✓ Columnas expenses.jobId/isGeneral/supplier agregadas (ADDITIVAS), verificado.')
  }

  const n = await db.execute('SELECT COUNT(*) as c FROM expenses')
  console.log(`   expenses en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
