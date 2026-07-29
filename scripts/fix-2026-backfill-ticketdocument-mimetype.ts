/**
 * Backfill de TicketDocument.mimeType para filas subidas antes del fix del
 * 2026-07-28 (el endpoint de subida nunca guardaba mimeType — ver commit del
 * mismo día). Sin ese campo, PhotoGallery clasifica todo como "Archivo
 * adjunto" en vez de "Foto y video", y el auto-import de fotos al Informe
 * Técnico no las encuentra.
 *
 * Infiera el mimeType desde la extensión del nombre de archivo — no hay otra
 * fuente confiable sin volver a bajar cada objeto de R2. Additivo y seguro:
 * solo actualiza filas con mimeType NULL, nunca toca fileUrl/name/nada más.
 *
 * Uso: npx tsx --env-file=.env.production.local scripts/fix-2026-backfill-ticketdocument-mimetype.ts
 */
import { createClient } from '@libsql/client'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
if (!url || !url.startsWith('libsql://')) {
  console.error('❌  DATABASE_URL debe ser libsql://. Corré con --env-file=.env.production.local')
  process.exit(1)
}
const client = createClient({ url, authToken })

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
}

const res = await client.execute('SELECT id, name FROM ticket_documents WHERE "mimeType" IS NULL')
console.log(`📋 Documentos con mimeType NULL: ${res.rows.length}`)

if (res.rows.length === 0) {
  console.log('✅ Nada que corregir.')
  await client.close()
  process.exit(0)
}

// Backup antes de escribir — snapshot de lo que se va a tocar.
const backupPath = join(process.cwd(), 'backups', `ticket-documents-mimetype-backfill-${Date.now()}.json`)
writeFileSync(backupPath, JSON.stringify(res.rows, null, 2))
console.log(`💾 Backup guardado en ${backupPath}`)

let updated = 0
let skipped = 0
for (const row of res.rows) {
  const id = String(row.id)
  const name = String(row.name)
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const mime = EXT_TO_MIME[ext]
  if (!mime) {
    console.log(`⚠️  Extensión desconocida, se deja sin tocar: ${name} (id=${id})`)
    skipped++
    continue
  }
  await client.execute({
    sql: 'UPDATE ticket_documents SET "mimeType" = ? WHERE id = ? AND "mimeType" IS NULL',
    args: [mime, id],
  })
  updated++
}

console.log(`\n✅ Actualizados: ${updated}`)
console.log(`⚠️  Sin extensión reconocida (sin tocar): ${skipped}`)
await client.close()
