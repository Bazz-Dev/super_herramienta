/**
 * INCIDENTE (2026-07-23): el código desplegado en dpl_EL3shuJs1bVttLMaAXpF72Z7WvJw
 * consulta tickets.otFileUrl, que nunca se aplicó a Turso — /informe (y
 * probablemente /tickets/[id], /mi-panel/tickets/[id]) están caídos en
 * producción con "no such column: tickets.otFileUrl". Aplica ADDITIVAMENTE
 * (sin rebuild de tabla) las 2 migraciones locales pendientes:
 *   - 20260722174820_add_ticket_ot_file      (tickets.otFileUrl)
 *   - 20260723041655_add_carnet_and_company_documents (tabla company_documents)
 * "carnet" como valor de DocType no requiere cambio — SQLite no valida enums,
 * es solo texto libre en la columna existente. Idempotente.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/add-ot-file-and-company-docs.ts
 */
import { createClient } from '@libsql/client'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  console.log('DB host →', new URL(process.env.DATABASE_URL!).host)

  // 1. tickets.otFileUrl
  let hasOtFileUrl = true
  try { await db.execute('SELECT otFileUrl FROM tickets LIMIT 1') } catch { hasOtFileUrl = false }
  if (hasOtFileUrl) {
    console.log('✓ tickets.otFileUrl ya existe — nada que hacer.')
  } else {
    await db.execute('ALTER TABLE tickets ADD COLUMN otFileUrl TEXT')
    await db.execute('SELECT otFileUrl FROM tickets LIMIT 1') // verificación
    console.log('✓ Columna tickets.otFileUrl agregada (ADDITIVA), verificado.')
  }

  // 2. company_documents
  let hasCompanyDocs = true
  try { await db.execute('SELECT 1 FROM company_documents LIMIT 1') } catch { hasCompanyDocs = false }
  if (hasCompanyDocs) {
    console.log('✓ tabla company_documents ya existe — nada que hacer.')
  } else {
    await db.execute(`CREATE TABLE company_documents (
      id TEXT NOT NULL PRIMARY KEY,
      tenantId TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'otro',
      label TEXT,
      fileUrl TEXT NOT NULL,
      uploadedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT company_documents_tenantId_fkey FOREIGN KEY (tenantId) REFERENCES tenants (id) ON DELETE CASCADE ON UPDATE CASCADE
    )`)
    await db.execute('CREATE INDEX IF NOT EXISTS company_documents_tenantId_idx ON company_documents(tenantId)')
    await db.execute('SELECT 1 FROM company_documents LIMIT 1') // verificación
    console.log('✓ Tabla company_documents creada + índice, verificado.')
  }

  const n = await db.execute('SELECT COUNT(*) as c FROM tickets')
  console.log(`   tickets en esta DB: ${n.rows[0]['c']}`)
  await db.close()
}
main()
