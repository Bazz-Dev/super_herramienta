/**
 * P1-3 (G2) — Backfill: promueve metadata.ticketId (JSON string-match, frágil) a la
 * columna real client_documents.ticketId. Solo escribe si:
 *   - metadata contiene un ticketId parseable,
 *   - ticketId ya no está seteado (columna actual NULL),
 *   - el Ticket referenciado EXISTE (si no, se reporta y se omite — no se inventa).
 * metadata NO se modifica ni se borra (otros campos como workOrder/branch siguen ahí).
 *
 * Dry-run por defecto. Escribe con --apply.
 * Run: npx tsx --env-file=.env[.production.local] scripts/backfill-clientdocument-ticketid.ts [--apply]
 */
import { createClient } from '@libsql/client'

const APPLY = process.argv.includes('--apply')

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  const rows = await db.execute(
    `SELECT id, metadata FROM client_documents WHERE ticketId IS NULL AND metadata IS NOT NULL AND metadata LIKE '%ticketId%'`
  )
  console.log(`Documentos con posible ticketId en metadata: ${rows.rows.length}`)

  let updated = 0, skippedNoMatch = 0, skippedNoTicket = 0

  for (const r of rows.rows) {
    const id = r['id'] as string
    let meta: { ticketId?: string }
    try { meta = JSON.parse(r['metadata'] as string) } catch { skippedNoMatch++; continue }
    if (!meta.ticketId) { skippedNoMatch++; continue }

    const ticket = await db.execute({ sql: `SELECT id FROM tickets WHERE id = ?`, args: [meta.ticketId] })
    if (!ticket.rows.length) {
      console.log(`   ⚠ ${id}: metadata.ticketId="${meta.ticketId}" no corresponde a un ticket existente — se omite`)
      skippedNoTicket++
      continue
    }

    if (APPLY) {
      await db.execute({ sql: `UPDATE client_documents SET ticketId = ? WHERE id = ?`, args: [meta.ticketId, id] })
    }
    console.log(`   ${APPLY ? '✏' : '[dry-run]'} ${id} → ticketId=${meta.ticketId}`)
    updated++
  }

  console.log(`\nResultado: ${updated} ${APPLY ? 'actualizados' : 'por actualizar'} | ${skippedNoMatch} sin ticketId parseable | ${skippedNoTicket} con ticket inexistente`)
  await db.close()
}
main()
