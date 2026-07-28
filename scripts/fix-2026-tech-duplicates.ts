// Corrección puntual encontrada en la auditoría de producción 2026-07-28:
// - "Alex Martinez"/"Alex Martínez" son el mismo técnico cargado dos veces
//   (mismo nombre salvo tilde, ninguno tiene RUT/teléfono/email para verificar
//   por otra vía, pero uno tiene 1 trabajo real y el otro 1 liquidación real —
//   sin evidencia de ser dos personas distintas).
// - Cristian Muñoz: el Technician ya está correctamente inactivo/despedido,
//   pero su User seguía con active=true — podía loguearse pese a estar dado
//   de baja. Se pidió conservar historial/cuenta, no acceso.
// - 379/381 jobs no tienen technicianId. De esos, 56 tienen un ticket de
//   origen (originTicketId) cuyo Ticket.assignedToId SÍ está poblado — se
//   propaga ese dato real (no se inventa nada) al Job. Los otros 325 jobs
//   no tienen ningún ticket vinculado del cual derivar el técnico — quedan
//   sin tocar, requieren asignación manual (no hay evidencia para inferirla).
//
// Backup automático antes de escribir. No borra ninguna fila.
// Run: npx tsx --env-file=.env.production.local scripts/fix-2026-tech-duplicates.ts

import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma'

const CANONICAL = 'cmqb2pt6n000004le6n24oa6l' // Alex Martinez — más antiguo, tiene el job real
const DUP = 'cmr1kcuq10005rktj4bzydcj2'        // Alex Martínez — duplicado, tiene la liquidación
const CRISTIAN_USER_EMAIL = 'cmunoz@ingegarchile.cl'

async function main() {
  if (!process.env.DATABASE_URL?.startsWith('libsql://')) {
    console.error('❌ DATABASE_URL no es libsql:// — correr con --env-file=.env.production.local')
    process.exit(1)
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const [techs, payrolls, users] = await Promise.all([
    prisma.technician.findMany({ where: { id: { in: [CANONICAL, DUP] } } }),
    prisma.payroll.findMany({ where: { technicianId: DUP } }),
    prisma.user.findMany({ where: { email: CRISTIAN_USER_EMAIL } }),
  ])
  writeFileSync(`backups/fix-2026-tech-duplicates-${stamp}.json`, JSON.stringify({ techs, payrolls, users }, null, 2))
  console.log(`✓ Backup escrito: backups/fix-2026-tech-duplicates-${stamp}.json`)

  const moved = await prisma.payroll.updateMany({ where: { technicianId: DUP }, data: { technicianId: CANONICAL } })
  await prisma.technician.update({
    where: { id: DUP },
    data: {
      notes: `[${new Date().toISOString().slice(0, 10)}] Registro duplicado de "Alex Martinez" (id ${CANONICAL}) — ${moved.count} liquidación(es) movida(s) al registro canónico. No usar este registro para nuevos trabajos.`,
    },
  })
  console.log(`✓ Payroll movidos a canónico: ${moved.count}. Nota agregada al duplicado.`)

  const cristian = await prisma.user.updateMany({ where: { email: CRISTIAN_USER_EMAIL }, data: { active: false } })
  console.log(`✓ User de Cristian Muñoz desactivado (login bloqueado, historial y cuenta intactos): ${cristian.count}`)

  // Backfill technicianId: Job -> originTicketId -> Ticket.assignedToId (un
  // User) -> User.technicianId (el Technician real). Ticket.assignedToId
  // apunta a User, NO a Technician directamente — hay que pasar por esa
  // segunda relación o se escribiría un User.id en Job.technicianId.
  const candidates = await prisma.job.findMany({
    where: { originTicketId: { not: null }, technicianId: null },
    select: { id: true, originTicketId: true },
  })
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: candidates.map((j) => j.originTicketId!) } },
    select: { id: true, assignedToId: true },
  })
  const userIds = tickets.map((t) => t.assignedToId).filter((x): x is string => !!x)
  const assigneeUsers = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, technicianId: true } })
  const userMap = new Map(assigneeUsers.map((u) => [u.id, u.technicianId]))
  const ticketMap = new Map(tickets.map((t) => [t.id, t.assignedToId]))
  writeFileSync(
    `backups/fix-2026-tech-backfill-jobs-${stamp}.json`,
    JSON.stringify(await prisma.job.findMany({ where: { id: { in: candidates.map((j) => j.id) } } }), null, 2),
  )
  let backfilled = 0
  for (const j of candidates) {
    const assignedToId = ticketMap.get(j.originTicketId!)
    const technicianId = assignedToId ? userMap.get(assignedToId) : null
    if (!technicianId) continue
    await prisma.job.update({ where: { id: j.id }, data: { technicianId } })
    backfilled++
  }
  console.log(`✓ Jobs con technicianId propagado desde su ticket: ${backfilled} / ${candidates.length} candidatos`)
  console.log(`ℹ Quedan sin técnico (sin ticket vinculado del cual derivarlo, requieren asignación manual): ${381 - 2 - backfilled}`)
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) }).finally(() => process.exit(0))
