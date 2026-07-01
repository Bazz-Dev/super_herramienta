/**
 * Syncs R2 bucket objects → TicketDocument records in the DB.
 * Also ensures every JB ticket has the correct folderKey set.
 *
 * Idempotent — safe to run multiple times.
 *
 * Run (local):  npx tsx --env-file=.env scripts/sync-r2-docs.ts
 * Run (prod):   npm run sync:r2:prod
 *               (requires .env.production.local with TURSO + R2 credentials)
 *
 * What it does:
 *  1. Fetches all tickets for the given client slug
 *  2. For each ticket, ensures folderKey = clients/{slug}/tickets/{code}
 *  3. Lists R2 objects at that prefix
 *  4. Creates TicketDocument rows for files not yet recorded in DB
 */
import path from 'path'
import { prisma } from '../src/lib/prisma.js'
import { listR2Objects, ticketFolderKey } from '../src/lib/r2.js'

const CLIENT_SLUG = process.env.SYNC_CLIENT_SLUG ?? 'justburger'

// ── helpers ───────────────────────────────────────────────────────────────────

function mimeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase()
  const MAP: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  }
  return MAP[ext] ?? 'application/octet-stream'
}

function humanName(key: string): string {
  return decodeURIComponent(path.basename(key))
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log(`\n🔄  Syncing R2 → TicketDocument  (client: ${CLIENT_SLUG})\n`)

const client = await prisma.client.findFirstOrThrow({
  where: { portalSlug: CLIENT_SLUG },
  select: { id: true, name: true },
})
console.log(`✓ Cliente: ${client.name}`)

const tickets = await prisma.ticket.findMany({
  where: { clientId: client.id },
  select: { id: true, ticketCode: true, folderKey: true },
  orderBy: { ticketCode: 'asc' },
})
console.log(`✓ Tickets a procesar: ${tickets.length}\n`)

// Pre-load all existing TicketDocument fileUrls to avoid duplicates
const existing = await prisma.ticketDocument.findMany({
  where: { ticket: { clientId: client.id } },
  select: { fileUrl: true },
})
const existingKeys = new Set(existing.map((d) => d.fileUrl))

let folderKeyFixed = 0
let docsCreated = 0
let docsSkipped = 0
let emptyFolders = 0

for (const ticket of tickets) {
  const expectedKey = ticketFolderKey(CLIENT_SLUG, ticket.ticketCode)

  // 1. Fix folderKey if missing or wrong
  if (ticket.folderKey !== expectedKey) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { folderKey: expectedKey },
    })
    folderKeyFixed++
  }

  // 2. List R2 objects at this folder
  const objects = await listR2Objects(expectedKey + '/')

  if (objects.length === 0) {
    // Try without trailing slash (some uploads omit it)
    const altObjects = await listR2Objects(expectedKey)
    if (altObjects.length === 0) {
      emptyFolders++
      continue
    }
    objects.push(...altObjects)
  }

  // 3. Create TicketDocument for each file not yet in DB
  for (const obj of objects) {
    if (existingKeys.has(obj.key)) {
      docsSkipped++
      continue
    }
    await prisma.ticketDocument.create({
      data: {
        ticketId: ticket.id,
        name: humanName(obj.key),
        fileUrl: obj.key,
        mimeType: mimeFromKey(obj.key),
        uploadedAt: obj.lastModified,
      },
    })
    existingKeys.add(obj.key)
    docsCreated++
    process.stdout.write(`  + ${ticket.ticketCode}  ${humanName(obj.key)}\n`)
  }
}

console.log(`
📊 Resultado:
   folderKey corregidos : ${folderKeyFixed}
   documentos creados   : ${docsCreated}
   documentos ya en DB  : ${docsSkipped}
   carpetas sin archivos: ${emptyFolders}
`)

await prisma.$disconnect()
console.log('✅ Listo.')
