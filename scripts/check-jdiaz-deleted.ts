/**
 * Read-only: ¿cuántos de los 57 tickets de Jesús Díaz (assignedToId) tienen
 * deletedAt seteado (soft-deleted)? Eso explicaría por qué /rrhh/[id]
 * (que filtra deletedAt:null) muestra muchos menos que el total real.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/check-jdiaz-deleted.ts
 */
import { prisma } from '../src/lib/prisma.js'

const user = await prisma.user.findUnique({ where: { email: 'jdiaz@ingegarchile.cl' }, select: { id: true } })
if (!user) { console.log('No se encontró jdiaz@ingegarchile.cl'); process.exit(0) }

const total = await prisma.ticket.count({ where: { assignedToId: user.id } })
const notDeleted = await prisma.ticket.count({ where: { assignedToId: user.id, deletedAt: null } })
const deleted = await prisma.ticket.count({ where: { assignedToId: user.id, NOT: { deletedAt: null } } })
const byStatus = await prisma.ticket.groupBy({
  by: ['status'],
  where: { assignedToId: user.id, deletedAt: null },
  _count: { id: true },
})

console.log(`Total assignedToId=jdiaz: ${total}`)
console.log(`  deletedAt = null (visible en /rrhh): ${notDeleted}`)
console.log(`  deletedAt != null (soft-deleted):     ${deleted}`)
console.log('\nPor estado (solo no-borrados):')
for (const row of byStatus) console.log(`  ${row.status}: ${row._count.id}`)

if (deleted > 0) {
  const sample = await prisma.ticket.findMany({
    where: { assignedToId: user.id, NOT: { deletedAt: null } },
    select: { ticketCode: true, title: true, status: true, deletedAt: true, createdAt: true },
    take: 5,
  })
  console.log('\nMuestra de tickets soft-deleted:')
  for (const t of sample) console.log(`  ${t.ticketCode} — ${t.title} — status=${t.status} — deletedAt=${t.deletedAt?.toISOString()}`)
}

await prisma.$disconnect()
