/**
 * Read-only: ¿ya se agregó la nota "Técnico histórico" a los 17 tickets
 * con discrepancia Excel(desvinculado) vs Turso(Juan Jesús Díaz)? Evita
 * duplicar si ya se hizo.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/check-historical-note-done.ts
 */
import { prisma } from '../src/lib/prisma.js'

const codes = [
  '20260510-ISIDORA-008', '20260510-LAFLORIDA-009', '20260510-LAREINA-004',
  '20260510-MACHALI-006', '20260510-MALLPASEOQ-007', '20260510-MANUELMONT-003',
  '20260510-MANUELMONT-020', '20260510-PROVIDENCI-005', '20260510-ROTONDAATE-001',
  '20260510-TOESCA-002', '20260510-TOESCA-021', '20260518-ISIDORA-003',
  '260514-JB-EM1-LAREINA', '260518-JB-EM1-HUECHURABA', '260520-JB-UR1-MACHALI',
  '260526-JB-EM1-MACHALI', '260527-JB-EM1-MANUELMONTT',
]

const tickets = await prisma.ticket.findMany({
  where: { ticketCode: { in: codes } },
  select: {
    id: true, ticketCode: true,
    history: { where: { note: { contains: 'histórico' } }, select: { note: true } },
  },
})

for (const t of tickets) {
  console.log(`${t.ticketCode.padEnd(30)} nota histórica ya existe: ${t.history.length > 0 ? 'SÍ — ' + t.history[0].note : 'NO'}`)
}

await prisma.$disconnect()
