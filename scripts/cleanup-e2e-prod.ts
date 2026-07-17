/**
 * Contención incidente G19 (2026-07-16): tickets E2E creados accidentalmente en
 * Turso producción. Flujo en dos fases con manifiesto de IDs exactos:
 *
 *   FASE 1 — scan (solo lectura):
 *     npx tsx --env-file=.env.production.local scripts/cleanup-e2e-prod.ts --scan
 *     Busca ÚNICAMENTE candidatos del incidente (títulos exactos conocidos +
 *     ventana temporal 2026-07-16, cliente justburger). Lista ticket, historial,
 *     documentos y notificaciones relacionadas. Escribe el manifiesto:
 *     docs/architecture/incident-g19-manifest.json  (revisar y aprobar a mano)
 *
 *   FASE 2 — apply (escritura, SOLO tras backup + aprobación del dry-run):
 *     npx tsx --env-file=.env.production.local scripts/cleanup-e2e-prod.ts --apply --confirm-g19
 *     Borra EXCLUSIVAMENTE los IDs del manifiesto, re-verificando id+código+título
 *     +fecha contra la DB. Si CUALQUIER registro no calza exactamente, ABORTA sin
 *     tocar nada. Ejecuta en transacción (db.batch). No toca usuarios, archivos R2
 *     ni notificaciones (solo las lista).
 *
 * Sin flags = dry-run informativo (igual que --scan pero sin escribir manifiesto).
 */
import { createClient } from '@libsql/client'
import { readFileSync, writeFileSync } from 'node:fs'

const MANIFEST_PATH = 'docs/architecture/incident-g19-manifest.json'

// Manifiesto del incidente: los únicos títulos con evidencia en logs (run3/run4).
// El tercer ticket (run4) no dejó título en logs: el scan lo encuentra SOLO dentro
// de la ventana del incidente y queda sujeto a revisión manual del manifiesto.
const KNOWN_TITLES = ['E2E Full mrnouu0c', 'E2E Full mrnovtgo']
const INCIDENT_DATE_PREFIX = '2026-07-16' // createdAt del incidente (UTC)

const SCAN = process.argv.includes('--scan')
const APPLY = process.argv.includes('--apply')
const CONFIRM = process.argv.includes('--confirm-g19')

const db = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

interface ManifestEntry {
  id: string
  ticketCode: string
  title: string
  createdAt: string
  historyCount: number
  documentCount: number
  itemCount: number
}

async function scanCandidates(): Promise<ManifestEntry[]> {
  // Búsqueda acotada al incidente: títulos exactos conocidos, o patrón E2E dentro
  // de la ventana temporal exacta y cliente justburger (para hallar el 3.º ticket).
  const res = await db.execute({
    sql: `SELECT t.id, t.ticketCode, t.title, t.createdAt,
                 (SELECT COUNT(*) FROM ticket_history  h WHERE h.ticketId = t.id) as hist,
                 (SELECT COUNT(*) FROM ticket_documents d WHERE d.ticketId = t.id) as docs,
                 (SELECT COUNT(*) FROM ticket_items    i WHERE i.ticketId = t.id) as items
          FROM tickets t
          JOIN clients c ON c.id = t.clientId
          WHERE c.portalSlug = 'justburger'
            AND ( t.title IN (?, ?)
                  OR (t.title LIKE 'E2E Full %' AND t.createdAt LIKE ?) )`,
    args: [KNOWN_TITLES[0], KNOWN_TITLES[1], `${INCIDENT_DATE_PREFIX}%`],
  })
  return res.rows.map((r) => ({
    id: String(r['id']),
    ticketCode: String(r['ticketCode']),
    title: String(r['title']),
    createdAt: String(r['createdAt']),
    historyCount: Number(r['hist']),
    documentCount: Number(r['docs']),
    itemCount: Number(r['items']),
  }))
}

async function listRelatedNotifications(codes: string[]) {
  if (!codes.length) return []
  const placeholders = codes.map(() => '?').join(',')
  const res = await db.execute({
    sql: `SELECT id, title, createdAt FROM notifications
          WHERE ${codes.map(() => `title LIKE '%' || ? || '%'`).join(' OR ')}`,
    args: codes,
  }).catch(() => ({ rows: [] as never[] }))
  void placeholders
  return res.rows
}

async function main() {
  const candidates = await scanCandidates()

  console.log('═══ INCIDENTE G19 — CANDIDATOS EXACTOS ═══')
  if (!candidates.length) { console.log('✓ 0 candidatos: la base no contiene tickets del incidente.'); await db.close(); return }
  for (const c of candidates) {
    console.log(`  ${c.ticketCode} | "${c.title}" | creado ${c.createdAt} | historial:${c.historyCount} docs:${c.documentCount} items:${c.itemCount}`)
    console.log(`    id: ${c.id}`)
  }
  const notis = await listRelatedNotifications(candidates.map(c => c.ticketCode))
  console.log(`  Notificaciones relacionadas (SOLO informativo, NO se borran): ${notis.length}`)
  for (const n of notis.slice(0, 10)) console.log(`    - ${n['id']} | ${String(n['title']).slice(0, 70)}`)

  if (SCAN) {
    writeFileSync(MANIFEST_PATH, JSON.stringify({ incident: 'G19', date: INCIDENT_DATE_PREFIX, entries: candidates }, null, 2))
    console.log(`\n✍ Manifiesto escrito: ${MANIFEST_PATH} — revísalo y apruébalo antes de --apply.`)
    await db.close(); return
  }

  if (!APPLY) { console.log('\n[dry-run] Nada borrado. Fases: --scan → revisar manifiesto → backup → --apply --confirm-g19'); await db.close(); return }
  if (!CONFIRM) { console.log('\n✗ --apply requiere también --confirm-g19 (confirmación explícita del reporte).'); await db.close(); process.exitCode = 1; return }

  // FASE 2: cargar manifiesto aprobado y verificar identidad EXACTA de cada registro
  let manifest: { entries: ManifestEntry[] }
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  } catch {
    console.log(`✗ No se pudo leer ${MANIFEST_PATH}. Ejecuta --scan primero y revisa el manifiesto.`)
    await db.close(); process.exitCode = 1; return
  }
  if (!manifest.entries?.length) { console.log('✗ Manifiesto vacío. Abortando.'); await db.close(); process.exitCode = 1; return }

  // Verificación estricta: cada entrada del manifiesto debe calzar id+código+título+fecha
  // en la DB, y NO puede haber en DB candidatos fuera del manifiesto.
  const manifestIds = new Set(manifest.entries.map(e => e.id))
  for (const c of candidates) {
    if (!manifestIds.has(c.id)) {
      console.log(`✗ ABORTADO: la DB contiene un candidato fuera del manifiesto (${c.ticketCode} "${c.title}"). Re-escanea y revisa.`)
      await db.close(); process.exitCode = 1; return
    }
  }
  for (const e of manifest.entries) {
    const row = await db.execute({ sql: `SELECT ticketCode, title, createdAt FROM tickets WHERE id = ?`, args: [e.id] })
    if (!row.rows.length) { console.log(`  (ya no existe: ${e.ticketCode} — se omite)`); manifestIds.delete(e.id); continue }
    const r = row.rows[0]
    if (r['ticketCode'] !== e.ticketCode || r['title'] !== e.title || r['createdAt'] !== e.createdAt) {
      console.log(`✗ ABORTADO: el registro ${e.id} no calza exactamente con el manifiesto (código/título/fecha). Nada fue borrado.`)
      await db.close(); process.exitCode = 1; return
    }
  }

  const ids = [...manifestIds]
  if (!ids.length) { console.log('✓ Nada que borrar (todo ya eliminado).'); await db.close(); return }

  // Borrado transaccional: batch de libsql = transacción única
  const stmts = ids.flatMap((id) => ([
    { sql: `DELETE FROM ticket_history   WHERE ticketId = ?`, args: [id] },
    { sql: `DELETE FROM ticket_documents WHERE ticketId = ?`, args: [id] },
    { sql: `DELETE FROM ticket_items     WHERE ticketId = ?`, args: [id] },
    { sql: `DELETE FROM tickets          WHERE id = ?`,       args: [id] },
  ]))
  await db.batch(stmts, 'write')
  console.log(`✓ Transacción aplicada: ${ids.length} tickets del manifiesto eliminados con su historial/documentos/items.`)
  console.log('  (Notificaciones y archivos R2 NO tocados — revisar manualmente si se desea.)')
  await db.close()
}
main()
