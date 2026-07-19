/**
 * Read-only: chequeo de emergencia — conteo total de tickets e historial
 * en producción, para confirmar si hay pérdida de datos real.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/emergency-check-tickets.ts
 */
import { prisma } from '../src/lib/prisma.js'

const ticketCount = await prisma.ticket.count()
const historyCount = await prisma.ticketHistory.count()
const docCount = await prisma.ticketDocument.count()
const clientDocCount = await prisma.clientDocument.count()
const byStatus = await prisma.ticket.groupBy({ by: ['status'], _count: { id: true } })
const byClient = await prisma.ticket.groupBy({ by: ['clientId'], _count: { id: true } })
const clients = await prisma.client.findMany({ select: { id: true, name: true } })
const clientMap = new Map(clients.map(c => [c.id, c.name]))
const oldest = await prisma.ticket.findFirst({ orderBy: { createdAt: 'asc' }, select: { ticketCode: true, createdAt: true } })
const newest = await prisma.ticket.findFirst({ orderBy: { createdAt: 'desc' }, select: { ticketCode: true, createdAt: true } })

console.log(`TOTAL tickets: ${ticketCount}`)
console.log(`TOTAL ticketHistory: ${historyCount}`)
console.log(`TOTAL ticketDocument: ${docCount}`)
console.log(`TOTAL clientDocument: ${clientDocCount}`)
console.log(`Ticket más antiguo: ${oldest?.ticketCode} (${oldest?.createdAt.toISOString()})`)
console.log(`Ticket más nuevo: ${newest?.ticketCode} (${newest?.createdAt.toISOString()})`)
console.log('\nPor estado:')
for (const row of byStatus) console.log(`  ${row.status}: ${row._count.id}`)
console.log('\nPor cliente:')
for (const row of byClient) console.log(`  ${clientMap.get(row.clientId) ?? row.clientId}: ${row._count.id}`)

await prisma.$disconnect()
