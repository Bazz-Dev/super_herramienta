/**
 * Limpieza de tickets E2E creados accidentalmente en Turso producción
 * (incidente 2026-07-16: `next start` local cargó .env.production.local y los
 * pasos 1-2 del spec full-ticket-flow crearon tickets de prueba en prod).
 *
 * SOLO toca tickets del cliente justburger cuyo título calza EXACTAMENTE con los
 * patrones E2E ('E2E Full %', 'E2E Sucursal %', 'E2E Interno DEC %').
 * Dry-run por defecto — lista lo que borraría. Escribe únicamente con --apply.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/cleanup-e2e-prod.ts [--apply]
 */
import { createClient } from '@libsql/client'

const APPLY = process.argv.includes('--apply')

const db = createClient({
  url:       process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function main() {
  const rows = await db.execute(
    `SELECT t.id, t.ticketCode, t.title, t.createdAt, c.name as clientName,
            (SELECT COUNT(*) FROM ticket_history h WHERE h.ticketId = t.id) as hist,
            (SELECT COUNT(*) FROM ticket_documents d WHERE d.ticketId = t.id) as docs
     FROM tickets t JOIN clients c ON c.id = t.clientId
     WHERE (t.title LIKE 'E2E Full %' OR t.title LIKE 'E2E Sucursal %' OR t.title LIKE 'E2E Interno DEC %')`
  )

  if (!rows.rows.length) { console.log('✓ No hay tickets E2E en esta base. Nada que limpiar.'); await db.close(); return }

  console.log(`Tickets E2E encontrados: ${rows.rows.length}`)
  for (const r of rows.rows) {
    console.log(`  - ${r['ticketCode']} | "${r['title']}" | ${r['clientName']} | creado ${r['createdAt']} | ${r['hist']} historial, ${r['docs']} docs`)
  }

  if (!APPLY) { console.log('\n[dry-run] Nada borrado. Ejecuta con --apply para eliminar EXACTAMENTE los listados.'); await db.close(); return }

  for (const r of rows.rows) {
    const id = r['id'] as string
    await db.execute({ sql: `DELETE FROM ticket_history   WHERE ticketId = ?`, args: [id] })
    await db.execute({ sql: `DELETE FROM ticket_documents WHERE ticketId = ?`, args: [id] })
    await db.execute({ sql: `DELETE FROM ticket_items     WHERE ticketId = ?`, args: [id] })
    await db.execute({ sql: `DELETE FROM tickets          WHERE id = ?`, args: [id] })
    console.log(`  ✂ eliminado ${r['ticketCode']}`)
  }
  console.log('✓ Limpieza completa.')
  await db.close()
}
main()
