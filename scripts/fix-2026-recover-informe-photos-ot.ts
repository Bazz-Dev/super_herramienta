/**
 * Recupera datos "perdidos" en Informes Técnicos ya guardados, causados por
 * dos bugs corregidos el 2026-07-28:
 *   1. El botón "Nuevo informe técnico" podía navegar sin guardar cambios
 *      pendientes (N° OT) del ticket → el informe quedaba sin OT aunque el
 *      ticket sí la tenía.
 *   2. El informe nunca importaba automáticamente las fotos ya subidas al
 *      ticket (funcionalidad que no existía hasta hoy).
 *
 * Additivo y conservador: SOLO completa lo que está vacío en el informe.
 * Nunca sobrescribe workOrder ni fotos que el informe ya tenga. Corre
 * DESPUÉS de fix-2026-backfill-ticketdocument-mimetype.ts (usa mimeType
 * para decidir qué documentos son foto; si no corriste ese primero, igual
 * infiere por extensión como respaldo).
 *
 * Uso: npx tsx --env-file=.env.production.local scripts/fix-2026-recover-informe-photos-ot.ts
 */
import { createClient } from '@libsql/client'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getObjectBuffer, isR2Key } from '../src/lib/r2.js'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !url.startsWith('libsql://')) {
  console.error('❌  DATABASE_URL debe ser libsql://. Corré con --env-file=.env.production.local')
  process.exit(1)
}
const client = createClient({ url, authToken })

const IMAGE_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
function inferImageMime(name: string, mimeType: string | null): string | null {
  if (mimeType?.startsWith('image/')) return mimeType
  if (mimeType) return null // mimeType conocido y no es imagen
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXT[ext] ?? null
}

type Informe = { id: string; dataJson: string | null; ticketId: string }
const informesRes = await client.execute(
  `SELECT id, "dataJson", "ticketId" FROM client_documents WHERE type = 'informe' AND "ticketId" IS NOT NULL`
)
const informes = informesRes.rows as unknown as Informe[]

const backup: { id: string; dataJson: string | null }[] = []
let otFixed = 0
let photosFixed = 0
let skipped = 0

for (const inf of informes) {
  let data: { workOrder?: string; photos?: { url: string; caption: string }[] }
  try { data = JSON.parse(inf.dataJson ?? '{}') } catch { skipped++; continue }

  const ticketRes = await client.execute({
    sql: 'SELECT "otNumber", "ticketCode" FROM tickets WHERE id = ?',
    args: [inf.ticketId],
  })
  const ticket = ticketRes.rows[0] as unknown as { otNumber: string | null; ticketCode: string } | undefined
  if (!ticket) { skipped++; continue }

  const docsRes = await client.execute({
    sql: 'SELECT id, name, "fileUrl", "mimeType" FROM ticket_documents WHERE "ticketId" = ?',
    args: [inf.ticketId],
  })
  const docs = docsRes.rows as unknown as { id: string; name: string; fileUrl: string; mimeType: string | null }[]

  let changed = false
  const missingOT = !data.workOrder && !!ticket.otNumber
  const recoverablePhotos = (data.photos?.length ?? 0) === 0 && docs.some(d => inferImageMime(d.name, d.mimeType))

  if (!missingOT && !recoverablePhotos) continue

  backup.push({ id: inf.id, dataJson: inf.dataJson })

  if (missingOT) {
    data.workOrder = ticket.otNumber!
    changed = true
    otFixed++
  }

  if (recoverablePhotos) {
    const photos: { url: string; caption: string }[] = []
    for (const d of docs) {
      const mime = inferImageMime(d.name, d.mimeType)
      if (!mime || !isR2Key(d.fileUrl)) continue
      try {
        const buf = await getObjectBuffer(d.fileUrl)
        photos.push({ url: `data:${mime};base64,${buf.toString('base64')}`, caption: d.name })
      } catch (e) {
        console.log(`⚠️  No se pudo bajar ${d.name} (${d.fileUrl}): ${e instanceof Error ? e.message : e}`)
      }
    }
    if (photos.length > 0) {
      data.photos = photos
      changed = true
      photosFixed++
    }
  }

  if (changed) {
    await client.execute({
      sql: 'UPDATE client_documents SET "dataJson" = ? WHERE id = ?',
      args: [JSON.stringify(data), inf.id],
    })
    console.log(`✓ [${ticket.ticketCode}] informe ${inf.id} — ${missingOT ? 'OT recuperada ' : ''}${recoverablePhotos ? `${data.photos?.length ?? 0} foto(s) recuperada(s)` : ''}`)
  }
}

if (backup.length > 0) {
  const backupPath = join(process.cwd(), 'backups', `client-documents-informe-recovery-${Date.now()}.json`)
  writeFileSync(backupPath, JSON.stringify(backup, null, 2))
  console.log(`\n💾 Backup de ${backup.length} informe(s) modificado(s) guardado en ${backupPath}`)
}

console.log(`\n✅ OT recuperada en ${otFixed} informe(s).`)
console.log(`✅ Fotos recuperadas en ${photosFixed} informe(s).`)
console.log(`⚠️  Omitidos (sin ticket o JSON inválido): ${skipped}`)
await client.close()
