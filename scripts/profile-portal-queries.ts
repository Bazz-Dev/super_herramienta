/**
 * Read-only: mide las queries reales que alimentan el portal cliente —
 * getClientTicket (detalle), getClientTickets (lista), y las queries del
 * dashboard del portal — contra Turso producción.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/profile-portal-queries.ts
 */
import { prisma } from '../src/lib/prisma.js'

const client = await prisma.client.findFirst({ where: { portalSlug: { not: null } }, select: { id: true, name: true, portalSlug: true } })
if (!client) { console.log('No hay clientes con portal'); process.exit(0) }
const ticket = await prisma.ticket.findFirst({ where: { clientId: client.id }, select: { id: true, ticketCode: true } })
console.log(`Cliente: ${client.name} (/${client.portalSlug}) — ticket ${ticket?.ticketCode ?? 'ninguno'}\n`)

async function time(label: string, fn: () => Promise<unknown>) {
  const t0 = performance.now()
  await fn()
  console.log(`${label.padEnd(45)} ${(performance.now() - t0).toFixed(0)}ms`)
}

if (ticket) {
  await time('getClientTicket() completo', () =>
    prisma.ticket.findFirst({
      where: { id: ticket.id, clientId: client.id, showToClient: true },
      include: {
        branch: { select: { id: true, name: true, city: true } },
        assignedTo: { select: { id: true, name: true } },
        items: { orderBy: { order: 'asc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
        history: { where: { isInternal: false }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, role: true } } } },
      },
    }),
  )
}

await time('getClientTickets() completo (lista)', () =>
  prisma.ticket.findMany({
    where: { clientId: client.id, deletedAt: null, showToClient: true, status: { notIn: ['fusionado'] } },
    select: {
      id: true, ticketCode: true, title: true, description: true, urgency: true, category: true, status: true,
      otNumber: true, estimatedDate: true, closedDate: true, folderKey: true, showToClient: true, createdAt: true, updatedAt: true,
      clientId: true, branchId: true, assignedToId: true,
      client: { select: { id: true, name: true, portalSlug: true } },
      branch: { select: { id: true, name: true, city: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { items: true, documents: true, history: true } },
    },
    orderBy: { createdAt: 'desc' },
  }),
)

console.log('\n--- Dashboard del portal ---')
await time('client.findUnique (login/theme)', () =>
  prisma.client.findUnique({ where: { portalSlug: client.portalSlug! }, select: { id: true, name: true, portalTheme: true, logoUrl: true } }),
)
await time('getClientTickets (para KPIs del dashboard)', () =>
  prisma.ticket.findMany({
    where: { clientId: client.id, deletedAt: null, showToClient: true, status: { notIn: ['fusionado'] } },
    select: { id: true, status: true, urgency: true, createdAt: true, estimatedDate: true, closedDate: true },
  }),
)

await prisma.$disconnect()
