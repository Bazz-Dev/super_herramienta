/**
 * Read-only: audita cuentas de usuario de técnicos (para "ver como" y
 * limpieza de accesos) + investiga el conteo de tickets de Jesús Díaz en
 * su ficha de técnico.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/audit-tecnico-accounts.ts
 */
import { prisma } from '../src/lib/prisma.js'

console.log('=== Técnicos (todos) ===')
const technicians = await prisma.technician.findMany({
  select: {
    id: true, name: true, active: true, contractType: true,
    user: { select: { id: true, name: true, email: true, active: true } },
  },
  orderBy: { name: 'asc' },
})
for (const t of technicians) {
  const u = t.user
  console.log(
    `${t.active ? '🟢' : '⚪'} ${t.name.padEnd(28)} contractType=${(t.contractType ?? '—').padEnd(12)} ` +
    (u ? `user=${u.email} (active=${u.active})` : 'SIN CUENTA')
  )
}

console.log('\n=== Users role=tecnico (todos, incluye posibles duplicados) ===')
const tecUsers = await prisma.user.findMany({
  where: { role: 'tecnico' },
  select: { id: true, name: true, email: true, active: true, technicianId: true, technician: { select: { name: true, active: true } } },
  orderBy: { name: 'asc' },
})
for (const u of tecUsers) {
  console.log(`${u.active ? '🟢' : '⚪'} ${u.name.padEnd(28)} ${u.email.padEnd(30)} technicianId=${u.technicianId ?? 'NULL'} -> ${u.technician?.name ?? '???'}`)
}

// Duplicate detection: same name or same technicianId appearing more than once
const byName = new Map<string, number>()
for (const u of tecUsers) byName.set(u.name, (byName.get(u.name) ?? 0) + 1)
const dupes = [...byName.entries()].filter(([, n]) => n > 1)
console.log('\n=== Posibles duplicados (mismo nombre, >1 cuenta) ===')
if (dupes.length === 0) console.log('Ninguno por nombre exacto.')
for (const [name, n] of dupes) console.log(`${name}: ${n} cuentas`)

console.log('\n=== Users role=supervisor (todos) ===')
const supUsers = await prisma.user.findMany({
  where: { role: 'supervisor' },
  select: { id: true, name: true, email: true, active: true },
  orderBy: { name: 'asc' },
})
for (const u of supUsers) console.log(`${u.active ? '🟢' : '⚪'} ${u.name.padEnd(28)} ${u.email}`)

console.log('\n=== Jesús Díaz — investigación de tickets ===')
const jesusTechs = technicians.filter(t => t.name.toLowerCase().includes('jesú') || t.name.toLowerCase().includes('jesu'))
for (const t of jesusTechs) {
  console.log(`\nTécnico: ${t.name} (id=${t.id})`)
  if (!t.user) { console.log('  Sin User vinculado — no puede tener assignedToId.'); continue }
  const byAssigned = await prisma.ticket.count({ where: { assignedToId: t.user.id } })
  console.log(`  Tickets con assignedToId = su User: ${byAssigned}`)
  const historyMentions = await prisma.ticketHistory.count({
    where: { note: { contains: t.name.split(' ')[0] } },
  })
  console.log(`  TicketHistory.note que menciona "${t.name.split(' ')[0]}": ${historyMentions}`)
  const assignmentCount = await prisma.assignmentAssignee.count({ where: { technicianId: t.id } })
  console.log(`  AssignmentAssignee (cronograma): ${assignmentCount}`)
}

await prisma.$disconnect()
