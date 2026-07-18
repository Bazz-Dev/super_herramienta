/**
 * Vincula los informes técnicos ("IT - ...") ya subidos a R2 como evidencia de
 * ticket (TicketDocument) hacia la carpeta de cliente Just Burger en /documentos
 * (ClientDocument type='informe'), sin duplicar el archivo — el fileKey apunta
 * al mismo objeto R2 ya existente.
 *
 * Estos son informes de trabajos anteriores a que el generador de informes
 * tuviera la opción "guardar en carpeta de cliente" — solo existían como
 * adjunto del ticket, invisibles en /documentos.
 *
 * NO toca "OT - ..." (órdenes de trabajo) ni evidencia fotográfica/WhatsApp —
 * solo archivos cuyo nombre empieza con "IT" (Informe Técnico).
 *
 * Dry-run por defecto. Con --apply crea los ClientDocument faltantes
 * (verifica por fileKey para ser idempotente en reruns).
 *
 * Run: npx tsx --env-file=.env.production.local scripts/link-jb-informes-to-carpeta.ts [--apply]
 */
import { createClient } from '@libsql/client'

const APPLY = process.argv.includes('--apply')
const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

function cuid(): string {
  // Same shape as Prisma's default cuid() — collision-safe enough for a one-off backfill
  return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

async function main() {
  const client = await db.execute({
    sql: `SELECT id, tenantId, name FROM clients WHERE portalSlug = ?`,
    args: ['justburger'],
  })
  if (!client.rows.length) { console.error('❌ Cliente justburger no encontrado'); await db.close(); return }
  const clientId = String(client.rows[0]['id'])
  const tenantId = String(client.rows[0]['tenantId'])
  console.log(`✓ Cliente: ${client.rows[0]['name']} (${clientId})`)

  const informes = await db.execute({
    sql: `SELECT td.id, td.ticketId, td.name, td.fileUrl, td.uploadedAt, t.ticketCode
          FROM ticket_documents td
          JOIN tickets t ON t.id = td.ticketId
          WHERE t.clientId = ? AND (td.name LIKE 'IT %' OR td.name LIKE 'IT-%')
          ORDER BY td.uploadedAt ASC`,
    args: [clientId],
  })
  console.log(`✓ Informes técnicos (evidencia de ticket) encontrados: ${informes.rows.length}`)

  const already = await db.execute({
    sql: `SELECT fileKey FROM client_documents WHERE clientId = ? AND type = 'informe'`,
    args: [clientId],
  })
  const existingKeys = new Set(already.rows.map(r => String(r['fileKey'])))

  const toCreate = informes.rows.filter(r => !existingKeys.has(String(r['fileUrl'])))
  console.log(`✓ Ya vinculados en /documentos: ${informes.rows.length - toCreate.length}`)
  console.log(`✓ Pendientes de vincular: ${toCreate.length}\n`)

  for (const r of toCreate) {
    console.log(`  [${r['ticketCode']}] ${r['name']}`)
  }

  if (!APPLY) {
    console.log('\n[dry-run] Nada creado. Ejecuta con --apply para vincularlos en /documentos.')
    await db.close()
    return
  }
  if (!toCreate.length) { console.log('✓ Nada pendiente.'); await db.close(); return }

  const now = new Date().toISOString()
  const stmts = toCreate.map(r => {
    const title = String(r['name']).replace(/\.pdf$/i, '').trim()
    return {
      sql: `INSERT INTO client_documents (id, tenantId, clientId, type, title, fileKey, ticketId, createdAt, updatedAt)
            VALUES (?, ?, ?, 'informe', ?, ?, ?, ?, ?)`,
      args: [cuid(), tenantId, clientId, title, String(r['fileUrl']), String(r['ticketId']), String(r['uploadedAt']) ?? now, now],
    }
  })
  await db.batch(stmts, 'write')
  console.log(`\n✓ ${toCreate.length} informes técnicos vinculados a la carpeta Just Burger en /documentos.`)
  await db.close()
}
main()
