/**
 * Repara SOLO la tabla de bookkeeping _applied_migrations — no toca jobs,
 * tickets ni ninguna tabla real. Los 7 nombres de abajo fueron confirmados
 * uno por uno vía _check-schema-drift.ts: sus columnas/tablas YA EXISTEN en
 * el schema real de Turso (aplicados en algún momento sin quedar
 * registrados en el ledger). Re-ejecutar su SQL sería destructivo — 3 de
 * ellos son "RedefineTables" de SQLite (DROP+RECREATE) que perderían
 * financialStage/operationalStage/docOt/code y todo su contenido si se
 * corrieran contra el schema actual, que ya tiene columnas posteriores que
 * esas migraciones no conocen. Este script NUNCA ejecuta su migration.sql
 * — solo inserta el nombre en el ledger para que turso-migrate.ts los trate
 * como ya aplicados y jamás intente re-correrlos.
 */
import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !url.startsWith('libsql://')) { console.error('DATABASE_URL no es libsql://'); process.exit(1) }
const client = createClient({ url, authToken })

const CONFIRMED_ALREADY_APPLIED = [
  '20260718003951_add_ticketid_to_clientdocument',
  '20260718111538_add_technician_rut_vehicle_plate_unique',
  '20260718230408_add_job_origin_proposal',
  '20260719045327_expense_pagado_status',
  '20260722174820_add_ticket_ot_file',
  '20260723041655_add_carnet_and_company_documents',
  '20260724052006_flujo_caja_v2_parallel_stages',
]

async function main() {
  for (const name of CONFIRMED_ALREADY_APPLIED) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO _applied_migrations (migration_name) VALUES (?)',
      args: [name],
    })
    console.log('✓ marcado como aplicado (sin ejecutar SQL):', name)
  }
  const after = await client.execute('SELECT COUNT(*) as n FROM _applied_migrations')
  console.log('\nTotal en ledger ahora:', after.rows[0].n)
}

main().then(() => process.exit(0)).catch((e) => { console.error('ERROR:', e); process.exit(1) })
