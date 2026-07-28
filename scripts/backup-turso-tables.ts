import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'
async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const tables = {
    tickets: await prisma.ticket.findMany(),
    ticketHistory: await prisma.ticketHistory.findMany(),
    jobs: await prisma.job.findMany(),
    branches: await prisma.branch.findMany(),
    clients: await prisma.client.findMany(),
  }
  const path = `backups/reconcile-2026-backup-${stamp}.json`
  writeFileSync(path, JSON.stringify(tables, null, 0))
  console.log(`✓ Backup escrito: ${path}`)
  for (const [k, v] of Object.entries(tables)) console.log(`  ${k}: ${v.length} filas`)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
