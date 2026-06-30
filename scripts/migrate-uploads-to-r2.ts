/**
 * One-time migration: local /public/uploads/* files → Cloudflare R2
 *
 * Handles:
 *   - TicketDocument records with fileUrl starting with /uploads/
 *   - TechnicianDocument records with fileUrl starting with /uploads/
 *   - Orphaned files in public/uploads/ not referenced in DB (deleted)
 *
 * Run: npx tsx --env-file=.env scripts/migrate-uploads-to-r2.ts
 * Run against prod: npx tsx --env-file=.env.production.local scripts/migrate-uploads-to-r2.ts
 */

import { readFile, unlink, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { prisma } from '../src/lib/prisma'
import { uploadToR2 } from '../src/lib/r2'
import { lookup } from 'node:dns/promises'

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads')

async function dirExists(p: string): Promise<boolean> {
  try { await readdir(p); return true } catch { return false }
}

async function migrateFile(localPath: string, r2Key: string): Promise<string | null> {
  try {
    const buf = await readFile(localPath)
    const ext = localPath.split('.').pop()?.toLowerCase() ?? 'bin'
    const ct = ext === 'pdf' ? 'application/pdf'
      : ext === 'png' ? 'image/png'
      : ['jpg', 'jpeg'].includes(ext) ? 'image/jpeg'
      : ext === 'webp' ? 'image/webp'
      : 'application/octet-stream'
    await uploadToR2(r2Key, buf, ct)
    return r2Key
  } catch (e) {
    console.error('  ✗ upload failed:', e instanceof Error ? e.message : e)
    return null
  }
}

// ── Ticket documents ─────────────────────────────────────────────────────────
const ticketDocs = await prisma.ticketDocument.findMany({
  where: { fileUrl: { startsWith: '/uploads/' } },
  select: { id: true, fileUrl: true, ticketId: true },
})

console.log(`\n🎫 Ticket docs with legacy paths: ${ticketDocs.length}`)

for (const doc of ticketDocs) {
  const localPath = join(process.cwd(), 'public', doc.fileUrl)
  const ext = doc.fileUrl.split('.').pop() ?? 'bin'
  const r2Key = `tickets/${doc.ticketId}/${doc.id}.${ext}`

  process.stdout.write(`  ${doc.fileUrl} → ${r2Key} … `)

  try {
    await readFile(localPath) // existence check
  } catch {
    console.log('⚠ file not found locally — skipping DB record (stale)')
    continue
  }

  const key = await migrateFile(localPath, r2Key)
  if (key) {
    await prisma.ticketDocument.update({ where: { id: doc.id }, data: { fileUrl: key } })
    console.log('✓')
  }
}

// ── Technician documents ──────────────────────────────────────────────────────
const techDocs = await prisma.technicianDocument.findMany({
  where: { fileUrl: { startsWith: '/uploads/' } },
  select: { id: true, fileUrl: true, technicianId: true },
})

console.log(`\n👷 Technician docs with legacy paths: ${techDocs.length}`)

for (const doc of techDocs) {
  const localPath = join(process.cwd(), 'public', doc.fileUrl)
  const ext = doc.fileUrl.split('.').pop() ?? 'bin'
  const r2Key = `technicians/${doc.technicianId}/${doc.id}.${ext}`

  process.stdout.write(`  ${doc.fileUrl} → ${r2Key} … `)

  try {
    await readFile(localPath)
  } catch {
    console.log('⚠ file not found locally — skipping DB record (stale)')
    continue
  }

  const key = await migrateFile(localPath, r2Key)
  if (key) {
    await prisma.technicianDocument.update({ where: { id: doc.id }, data: { fileUrl: key } })
    console.log('✓')
  }
}

// ── Orphaned files in public/uploads/ ────────────────────────────────────────
console.log('\n🗑  Scanning for orphaned files in public/uploads/ …')

if (await dirExists(UPLOADS_DIR)) {
  async function scanDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        await scanDir(full)
      } else {
        const rel = '/' + full.replace(/\\/g, '/').split('public/')[1]
        // Check if any DB record still references this path
        const [td, tcd] = await Promise.all([
          prisma.ticketDocument.count({ where: { fileUrl: rel } }),
          prisma.technicianDocument.count({ where: { fileUrl: rel } }),
        ])
        if (td === 0 && tcd === 0) {
          await unlink(full)
          console.log(`  🗑 deleted orphan: ${rel}`)
        } else {
          console.log(`  ⚠ still referenced: ${rel}`)
        }
      }
    }
  }
  await scanDir(UPLOADS_DIR)
} else {
  console.log('  (no uploads directory found)')
}

await prisma.$disconnect()
console.log('\n✅ Migration complete.')
