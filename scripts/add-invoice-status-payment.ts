/**
 * Agrega jobs.invoiceStatus, jobs.paymentAmount y job_installments.invoiceStatus
 * de forma ADDITIVA (informe #13). Todo nullable, sin default — facturas/pagos
 * históricos quedan sin estos campos (nunca se infiere "vigente" ni un monto
 * pagado a la fuerza). Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-invoice-status-payment.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let jobsHasCol = true
  try { await db.execute('SELECT invoiceStatus, paymentAmount FROM jobs LIMIT 1') } catch { jobsHasCol = false }
  if (jobsHasCol) {
    console.log('✓ jobs.invoiceStatus/paymentAmount ya existen — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE jobs ADD COLUMN invoiceStatus TEXT')
    await db.execute('ALTER TABLE jobs ADD COLUMN paymentAmount INTEGER')
    await db.execute('SELECT invoiceStatus, paymentAmount FROM jobs LIMIT 1')
    console.log('✓ Columnas jobs.invoiceStatus/paymentAmount agregadas (ADDITIVAS), verificado.')
  }

  let installmentsHasCol = true
  try { await db.execute('SELECT invoiceStatus FROM job_installments LIMIT 1') } catch { installmentsHasCol = false }
  if (installmentsHasCol) {
    console.log('✓ job_installments.invoiceStatus ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE job_installments ADD COLUMN invoiceStatus TEXT')
    await db.execute('SELECT invoiceStatus FROM job_installments LIMIT 1')
    console.log('✓ Columna job_installments.invoiceStatus agregada (ADDITIVA), verificado.')
  }

  const j = await db.execute('SELECT COUNT(*) as c FROM jobs')
  const i = await db.execute('SELECT COUNT(*) as c FROM job_installments')
  console.log(`   jobs: ${j.rows[0]['c']} · job_installments: ${i.rows[0]['c']}`)
  await db.close()
}
main()
