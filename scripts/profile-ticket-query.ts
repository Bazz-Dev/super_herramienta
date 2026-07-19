/**
 * Read-only: mide cuánto tarda realmente getTicket() (con todos sus include
 * anidados) contra Turso producción, para diagnosticar la queja de
 * lentitud al abrir un ticket.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/profile-ticket-query.ts
 */
import { prisma } from '../src/lib/prisma.js'

const sample = await prisma.ticket.findFirst({ select: { id: true, ticketCode: true } })
if (!sample) { console.log('No hay tickets en esta DB'); process.exit(0) }
console.log(`Midiendo con ticket ${sample.ticketCode} (${sample.id})\n`)

async function time(label: string, fn: () => Promise<unknown>) {
  const t0 = performance.now()
  await fn()
  const ms = performance.now() - t0
  console.log(`${label.padEnd(45)} ${ms.toFixed(0)}ms`)
  return ms
}

// Réplica exacta de getTicket() en src/lib/tickets/tickets.ts
await time('getTicket() completo (con todos los include)', () =>
  prisma.ticket.findFirst({
    where: { id: sample.id },
    include: {
      client: { select: { id: true, name: true, portalSlug: true } },
      branch: { select: { id: true, name: true, city: true } },
      assignedTo: { select: { id: true, name: true, technician: { select: { id: true } } } },
      createdBy: { select: { id: true, name: true } },
      collaborators: { include: { technician: { select: { id: true, name: true } } } },
      items: { orderBy: { order: 'asc' } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      history: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true } } } },
    },
  }),
)

// Desglose: solo el ticket base, sin includes
await time('  └ solo ticket base (sin include)', () =>
  prisma.ticket.findFirst({ where: { id: sample.id } }),
)

// Las 5 queries "hermanas" de la página (technicians, staffUsers, informes, expenses, jobs)
const tenantId = (await prisma.ticket.findUnique({ where: { id: sample.id }, select: { tenantId: true } }))!.tenantId
await time('  └ technicians (findMany)', () =>
  prisma.technician.findMany({ where: { tenantId, active: true }, select: { id: true, name: true } }),
)
await time('  └ staffUsers (findMany)', () =>
  prisma.user.findMany({ where: { tenantId, role: { in: ['super', 'supervisor', 'tecnico'] }, active: true }, select: { id: true, name: true, role: true } }),
)
await time('  └ allInformes (findMany)', () =>
  prisma.clientDocument.findMany({ where: { tenantId, type: 'informe', ticketId: sample.id } }),
)
await time('  └ ticketExpenses (findMany)', () =>
  prisma.expense.findMany({ where: { ticketId: sample.id, tenantId }, include: { technician: { select: { name: true } } } }),
)
await time('  └ originJobs (findMany)', () =>
  prisma.job.findMany({ where: { originTicketId: sample.id, tenantId } }),
)

console.log('\n--- Total simulando el patrón VIEJO (getTicket solo, luego las 5 en paralelo) ---')
const t0 = performance.now()
await prisma.ticket.findFirst({
  where: { id: sample.id },
  include: {
    client: true, branch: true, assignedTo: { include: { technician: true } }, createdBy: true,
    collaborators: { include: { technician: true } }, items: true, documents: true,
    history: { include: { user: true } },
  },
})
const afterGetTicket = performance.now()
await Promise.all([
  prisma.technician.findMany({ where: { tenantId, active: true } }),
  prisma.user.findMany({ where: { tenantId, role: { in: ['super', 'supervisor', 'tecnico'] }, active: true } }),
  prisma.clientDocument.findMany({ where: { tenantId, type: 'informe', ticketId: sample.id } }),
  prisma.expense.findMany({ where: { ticketId: sample.id, tenantId } }),
  prisma.job.findMany({ where: { originTicketId: sample.id, tenantId } }),
])
const total = performance.now() - t0
console.log(`getTicket() sola: ${(afterGetTicket - t0).toFixed(0)}ms | +5 queries en paralelo: ${(total - (afterGetTicket - t0)).toFixed(0)}ms | TOTAL viejo: ${total.toFixed(0)}ms`)

console.log('\n--- Total simulando el patrón NUEVO (las 6 en un solo Promise.all) ---')
const t1 = performance.now()
await Promise.all([
  prisma.ticket.findFirst({
    where: { id: sample.id },
    include: {
      client: true, branch: true, assignedTo: { include: { technician: true } }, createdBy: true,
      collaborators: { include: { technician: true } }, items: true, documents: true,
      history: { include: { user: true } },
    },
  }),
  prisma.technician.findMany({ where: { tenantId, active: true } }),
  prisma.user.findMany({ where: { tenantId, role: { in: ['super', 'supervisor', 'tecnico'] }, active: true } }),
  prisma.clientDocument.findMany({ where: { tenantId, type: 'informe', ticketId: sample.id } }),
  prisma.expense.findMany({ where: { ticketId: sample.id, tenantId } }),
  prisma.job.findMany({ where: { originTicketId: sample.id, tenantId } }),
])
const totalNew = performance.now() - t1
console.log(`TOTAL nuevo: ${totalNew.toFixed(0)}ms`)
console.log(`\nAhorro: ${(total - totalNew).toFixed(0)}ms (${(((total - totalNew) / total) * 100).toFixed(0)}%)`)

await prisma.$disconnect()
