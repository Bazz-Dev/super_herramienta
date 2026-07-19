/**
 * Read-only: ¿el costo de getTicket()/getClientTicket() es por N round-trips
 * separados (uno por relación) contra Turso, o por el query en sí? Prueba
 * relationLoadStrategy: 'join' (una sola query SQL con JOINs) vs el default.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/profile-relation-strategy.ts
 */
import { prisma } from '../src/lib/prisma.js'

const sample = await prisma.ticket.findFirst({ select: { id: true, ticketCode: true } })
if (!sample) { console.log('No hay tickets'); process.exit(0) }
console.log(`Ticket: ${sample.ticketCode}\n`)

async function time(label: string, fn: () => Promise<unknown>) {
  const t0 = performance.now()
  await fn()
  console.log(`${label.padEnd(50)} ${(performance.now() - t0).toFixed(0)}ms`)
}

const includeShape = {
  client: { select: { id: true, name: true, portalSlug: true } },
  branch: { select: { id: true, name: true, city: true } },
  assignedTo: { select: { id: true, name: true, technician: { select: { id: true } } } },
  createdBy: { select: { id: true, name: true } },
  collaborators: { include: { technician: { select: { id: true, name: true } } } },
  items: { orderBy: { order: 'asc' as const } },
  documents: { orderBy: { uploadedAt: 'desc' as const } },
  history: { orderBy: { createdAt: 'desc' as const }, include: { user: { select: { id: true, name: true } } } },
}

await time('default (sin relationLoadStrategy)', () =>
  prisma.ticket.findFirst({ where: { id: sample.id }, include: includeShape }),
)

// relationLoadStrategy: no soportado para SQLite/libSQL en Prisma 7 (confirmado:
// "Unknown argument `relationLoadStrategy`") — cada relación SIEMPRE es un
// round-trip separado contra Turso, sin opción de forzar JOIN vía Prisma.

console.log('\n--- Desglose: cada relación por separado (round-trip individual) ---')
await time('client', () => prisma.ticket.findFirst({ where: { id: sample.id }, select: { client: true } }))
await time('branch', () => prisma.ticket.findFirst({ where: { id: sample.id }, select: { branch: true } }))
await time('assignedTo+technician', () => prisma.ticket.findFirst({ where: { id: sample.id }, select: { assignedTo: { include: { technician: true } } } }))
await time('createdBy', () => prisma.ticket.findFirst({ where: { id: sample.id }, select: { createdBy: true } }))
await time('collaborators+technician', () => prisma.ticket.findFirst({ where: { id: sample.id }, select: { collaborators: { include: { technician: true } } } }))
await time('items', () => prisma.ticket.findFirst({ where: { id: sample.id }, select: { items: true } }))
await time('documents', () => prisma.ticket.findFirst({ where: { id: sample.id }, select: { documents: true } }))
await time('history+user', () => prisma.ticket.findFirst({ where: { id: sample.id }, select: { history: { include: { user: true } } } }))
await time('ticket base (sin relaciones)', () => prisma.ticket.findFirst({ where: { id: sample.id } }))

await prisma.$disconnect()
