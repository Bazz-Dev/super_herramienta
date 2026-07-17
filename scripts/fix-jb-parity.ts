/**
 * Corrección de paridad interno↔portal para JB (reporte del dueño 2026-07-17):
 *
 *   A) Elimina los 2 tickets basura de prueba (IDs exactos, verificados contra el
 *      backup): "1111111" y "33333", ambos fusionado, creados 2026-07-01.
 *   B) Normaliza showToClient=true en TODOS los tickets — decisión de negocio:
 *      "todos los tickets, incluso los resueltos, deben aparecer para el cliente
 *      y para nosotros". El campo venía de la columna "Mostrar" del Excel legado
 *      y dejaba 2 tickets reales (resueltos) invisibles en el portal.
 *
 * Dry-run por defecto. Escribe con --apply.
 * Run: npx tsx --env-file=.env.production.local scripts/fix-jb-parity.ts [--apply]
 */
import { createClient } from '@libsql/client'

const APPLY = process.argv.includes('--apply')
const JUNK_IDS = ['cmr1c5djl001v8otjm5vnozj2', 'cmr1c5e05001w8otjxmsbwrl5']

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  // A) Verificar identidad exacta antes de borrar — abortar si no calza
  console.log('═══ A. TICKETS BASURA (IDs exactos) ═══')
  for (const id of JUNK_IDS) {
    const r = await db.execute({ sql: `SELECT ticketCode, title, status FROM tickets WHERE id = ?`, args: [id] })
    if (!r.rows.length) { console.log(`   (ya no existe: ${id})`); continue }
    const t = r.rows[0]
    if (t['status'] !== 'fusionado' || !['1111111', '33333'].includes(String(t['title']))) {
      console.log(`✗ ABORTADO: ${id} no calza con lo esperado (título/estado cambiaron). Nada borrado.`)
      await db.close(); process.exitCode = 1; return
    }
    console.log(`   ${t['ticketCode']} | "${t['title']}" | ${APPLY ? '✂ eliminando' : '[dry-run] eliminaría'}`)
    if (APPLY) {
      await db.batch([
        { sql: `DELETE FROM ticket_history WHERE ticketId = ?`, args: [id] },
        { sql: `DELETE FROM ticket_documents WHERE ticketId = ?`, args: [id] },
        { sql: `DELETE FROM ticket_items WHERE ticketId = ?`, args: [id] },
        { sql: `DELETE FROM tickets WHERE id = ?`, args: [id] },
      ], 'write')
    }
  }

  // B) Normalizar showToClient
  console.log('\n═══ B. NORMALIZAR showToClient=true ═══')
  const hidden = await db.execute(`SELECT id, ticketCode, title, status FROM tickets WHERE showToClient = 0`)
  console.log(`   Tickets actualmente ocultos al cliente: ${hidden.rows.length}`)
  for (const r of hidden.rows) console.log(`   - ${r['ticketCode']} | "${r['title']}" | status=${r['status']}`)
  if (APPLY && hidden.rows.length) {
    await db.execute(`UPDATE tickets SET showToClient = 1 WHERE showToClient = 0`)
    console.log(`   ✏ ${hidden.rows.length} tickets actualizados a showToClient=true`)
  } else if (!APPLY) {
    console.log(`   [dry-run] ${hidden.rows.length} se actualizarían con --apply`)
  }

  await db.close()
}
main()
