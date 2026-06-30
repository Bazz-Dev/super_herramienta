/**
 * DRY RUN — Analyze JustBurger Drive folders before migration.
 * Reports: which folders match tickets, which are orphans, what files exist.
 * Run: npx tsx --env-file=.env scripts/analyze-drive-folders.ts
 */

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '../src/lib/prisma'

const DRIVE_DIR = join(process.cwd(), 'JUSTbURGER - Trabajos')

// Fetch all JB tickets with their ticketCode
const tickets = await prisma.ticket.findMany({
  where: { client: { portalSlug: 'justburger' } },
  select: { id: true, ticketCode: true, branch: { select: { name: true } }, createdAt: true, status: true },
})
const ticketByCode = new Map(tickets.map(t => [t.ticketCode, t]))
console.log(`\n📋 Tickets JustBurger en DB: ${tickets.length}`)

// Scan Drive folder
const entries = await readdir(DRIVE_DIR, { withFileTypes: true })
const folders = entries.filter(e => e.isDirectory()).map(e => e.name)

const matched: string[] = []
const patternA: string[] = []
const patternB_unmatched: string[] = []
const archive: string[] = []

for (const folder of folders) {
  if (folder.startsWith('_')) { archive.push(folder); continue }

  // Pattern B: YYMMDD-JB-TIPO-SUCURSAL[-NRO] — matches ticketCode
  if (/^\d{6}-JB-/.test(folder)) {
    if (ticketByCode.has(folder)) {
      matched.push(folder)
    } else {
      patternB_unmatched.push(folder)
    }
  } else {
    // Pattern A: 20260510-SUCURSAL-NRO
    patternA.push(folder)
  }
}

console.log(`\n✅ PATRÓN B — Coinciden con ticketCode en DB: ${matched.length}`)
for (const f of matched) {
  const t = ticketByCode.get(f)!
  const files = await readdir(join(DRIVE_DIR, f))
  console.log(`   ${f}  →  ticket: ${t.id.slice(0,8)}  branch: ${t.branch?.name ?? '-'}  archivos: ${files.length}`)
}

console.log(`\n⚠️  PATRÓN B — Sin match en DB: ${patternB_unmatched.length}`)
for (const f of patternB_unmatched) {
  const files = await readdir(join(DRIVE_DIR, f))
  console.log(`   ${f}  (${files.length} archivos) — ticket no existe en DB`)
}

console.log(`\n📦 PATRÓN A (sistema anterior): ${patternA.length} carpetas, serán archivadas en R2`)
let patternAFiles = 0
for (const f of patternA) {
  const files = await readdir(join(DRIVE_DIR, f))
  patternAFiles += files.length
}
console.log(`   Total archivos: ${patternAFiles}`)
for (const f of patternA) {
  const files = await readdir(join(DRIVE_DIR, f))
  console.log(`   ${f}  (${files.length} archivos)`)
}

console.log(`\n🗄️  ARCHIVE (_archive_orphans): ${archive.length} carpeta(s)`)

// Summary of what migration will do
console.log(`\n${'─'.repeat(60)}`)
console.log('PLAN DE MIGRACIÓN:')
console.log(`  ✅ ${matched.length} carpetas → R2: clients/justburger/tickets/{ticketCode}/`)
console.log(`     + Ticket.folderKey actualizado + TicketDocument creado por archivo`)
console.log(`  📦 ${patternA.length} carpetas → R2: clients/justburger/archive/{folder}/`)
console.log(`     (sistema anterior, sin vinculación a ticket — acceso manual)`)
console.log(`  ⚠️  ${patternB_unmatched.length} carpetas Patrón B sin match → R2: clients/justburger/archive/`)
console.log(`     (ticketCode no encontrado en DB — revisar manualmente)`)
console.log(`${'─'.repeat(60)}`)

// Tickets with NO folder at all
const ticketsWithoutFolder = tickets.filter(t => !matched.includes(t.ticketCode))
console.log(`\n📌 Tickets en DB sin carpeta en Drive: ${ticketsWithoutFolder.length}`)
for (const t of ticketsWithoutFolder) {
  console.log(`   ${t.ticketCode}  ${t.branch?.name ?? '-'}  ${t.status}`)
}

await prisma.$disconnect()
