/**
 * Migrate JustBurger Drive folders → Cloudflare R2
 *
 * Run against LOCAL DB:   npx tsx --env-file=.env scripts/migrate-drive-to-r2.ts
 * Run against PRODUCTION: npm run migrate:drive:prod
 *
 * What it does:
 *  - Pattern B (YYMMDD-JB-TIPO-SUCURSAL): matches ticketCode → uploads to
 *    clients/justburger/tickets/{ticketCode}/, sets Ticket.folderKey, creates TicketDocument records
 *  - Pattern A (YYYYMMDD-SUCURSAL-NRO): pre-app system → uploads to
 *    clients/justburger/archive/{folderName}/ (no DB linkage, accessible via R2 key)
 *  - Empty folders: skipped, reported
 *  - _archive_* folders: skipped
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { prisma } from '../src/lib/prisma'
import { uploadToR2, ticketFolderKey } from '../src/lib/r2'
import { randomUUID } from 'node:crypto'

const DRIVE_DIR = join(process.cwd(), 'JUSTbURGER - Trabajos')
const CLIENT_SLUG = 'justburger'
const DRY_RUN = process.env.DRY_RUN === '1'

if (DRY_RUN) console.log('\n🔍 DRY RUN MODE — no se subirá nada ni se modificará la DB\n')

function mime(ext: string): string {
  const m: Record<string, string> = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return m[ext.toLowerCase()] ?? 'application/octet-stream'
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-()áéíóúÁÉÍÓÚñÑ ]/g, '_').trim()
}

// ── Fetch all JB tickets from DB ──────────────────────────────────────────────
const client = await prisma.client.findFirst({
  where: { portalSlug: CLIENT_SLUG },
  select: { id: true, name: true },
})
if (!client) { console.error('❌ Cliente justburger no encontrado en DB'); process.exit(1) }

const tickets = await prisma.ticket.findMany({
  where: { clientId: client.id },
  select: { id: true, ticketCode: true, folderKey: true },
})
const ticketByCode = new Map(tickets.map(t => [t.ticketCode, t]))
console.log(`\n📋 Cliente: ${client.name} (${tickets.length} tickets en DB)`)

// ── Scan Drive folders ────────────────────────────────────────────────────────
const entries = await readdir(DRIVE_DIR, { withFileTypes: true })
const folders = entries.filter(e => e.isDirectory() && !e.name.startsWith('_')).map(e => e.name)
console.log(`📁 Carpetas a procesar: ${folders.length}\n`)

let uploaded = 0, skipped = 0, linked = 0, archived = 0

for (const folder of folders) {
  const folderPath = join(DRIVE_DIR, folder)
  const files = (await readdir(folderPath, { withFileTypes: true })).filter(e => e.isFile())

  const isPatternB = /^\d{6}-JB-/.test(folder)
  const ticket = isPatternB ? ticketByCode.get(folder) : null

  if (isPatternB) {
    if (!ticket) {
      console.log(`⚠️  ${folder} — ticketCode no encontrado en DB, se archivará`)
    }
  }

  if (files.length === 0) {
    console.log(`   ↳ ${folder}  (vacía, skipped)`)
    skipped++
    continue
  }

  const r2Prefix = ticket
    ? ticketFolderKey(CLIENT_SLUG, folder)         // clients/justburger/tickets/260512-JB-EM1-MACHALI
    : `clients/${CLIENT_SLUG}/archive/${folder}`    // clients/justburger/archive/20260510-TOESCA-002

  const label = ticket ? `✅ TICKET` : `📦 ARCHIVE`
  console.log(`${label}  ${folder}  →  ${r2Prefix}/  (${files.length} archivos)`)

  for (const file of files) {
    const ext = extname(file.name).slice(1)
    const safeKey = `${r2Prefix}/${safeFilename(file.name)}`
    process.stdout.write(`        ${file.name}  →  `)

    if (DRY_RUN) {
      console.log(`[DRY] ${safeKey}`)
      uploaded++
      continue
    }

    try {
      const buf = await readFile(join(folderPath, file.name))
      await uploadToR2(safeKey, buf, mime(ext))
      process.stdout.write(`✓ R2\n`)

      // If linked to ticket: create TicketDocument record
      if (ticket) {
        const existing = await prisma.ticketDocument.findFirst({
          where: { ticketId: ticket.id, name: file.name },
          select: { id: true },
        })
        if (!existing) {
          await prisma.ticketDocument.create({
            data: {
              id: randomUUID(),
              ticketId: ticket.id,
              name: file.name,
              fileUrl: safeKey,
              uploadedById: null,  // migración histórica
            },
          })
        }
      }
      uploaded++
    } catch (e) {
      console.log(`✗ ERROR: ${e instanceof Error ? e.message : e}`)
    }
  }

  // Update ticket.folderKey in DB
  if (ticket && !DRY_RUN) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { folderKey: r2Prefix },
    })
    linked++
    archived++
  } else if (!ticket && !DRY_RUN) {
    archived++
  }
}

await prisma.$disconnect()

console.log(`\n${'─'.repeat(60)}`)
console.log(`✅ Migración completa${DRY_RUN ? ' (DRY RUN)' : ''}:`)
console.log(`   Archivos subidos:       ${uploaded}`)
console.log(`   Tickets vinculados:     ${linked}`)
console.log(`   Carpetas archivadas:    ${archived - linked}`)
console.log(`   Carpetas vacías omit.:  ${skipped}`)
console.log(`${'─'.repeat(60)}`)
if (!DRY_RUN) {
  console.log('\n💡 Recuerda eliminar la carpeta local "JUSTbURGER - Trabajos"')
  console.log('   una vez verificado que todo esté en R2.')
}
