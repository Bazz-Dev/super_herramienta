/**
 * Agrega jobs.purchaseOrderStatus, job_installments.purchaseOrderStatus y
 * job_installments.paymentMethodRaw de forma ADDITIVA (informe #11). Todo
 * nullable, sin default — las OC históricas quedan sin estado (nunca se
 * infiere "vigente" a la fuerza). Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-purchase-order-status.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  let jobsHasCol = true
  try { await db.execute('SELECT purchaseOrderStatus FROM jobs LIMIT 1') } catch { jobsHasCol = false }
  if (jobsHasCol) {
    console.log('✓ jobs.purchaseOrderStatus ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE jobs ADD COLUMN purchaseOrderStatus TEXT')
    await db.execute('SELECT purchaseOrderStatus FROM jobs LIMIT 1')
    console.log('✓ Columna jobs.purchaseOrderStatus agregada (ADDITIVA), verificado.')
  }

  let installmentsHasCol = true
  try { await db.execute('SELECT purchaseOrderStatus, paymentMethodRaw FROM job_installments LIMIT 1') } catch { installmentsHasCol = false }
  if (installmentsHasCol) {
    console.log('✓ job_installments.purchaseOrderStatus/paymentMethodRaw ya existen — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE job_installments ADD COLUMN purchaseOrderStatus TEXT')
    await db.execute('ALTER TABLE job_installments ADD COLUMN paymentMethodRaw TEXT')
    await db.execute('SELECT purchaseOrderStatus, paymentMethodRaw FROM job_installments LIMIT 1')
    console.log('✓ Columnas job_installments.purchaseOrderStatus/paymentMethodRaw agregadas (ADDITIVAS), verificado.')
  }

  const j = await db.execute('SELECT COUNT(*) as c FROM jobs')
  const i = await db.execute('SELECT COUNT(*) as c FROM job_installments')
  console.log(`   jobs: ${j.rows[0]['c']} · job_installments: ${i.rows[0]['c']}`)
  await db.close()
}
main()
