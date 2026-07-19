/**
 * Enlaza cmunoz@ingegarchile.cl (User, role=supervisor) con la Technician
 * "Cristian Muñoz" (contractType=plazo_fijo) — hoy technicianId es NULL.
 * No cambia su rol (sigue supervisor, no técnico) — solo enlaza el perfil
 * para que RR.HH./ficha/cronograma lo reconozcan como la misma persona.
 * Idempotente: si ya está enlazado, no hace nada.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/link-cristian-technician.ts [--apply]
 */
import { prisma } from '../src/lib/prisma.js'

const APPLY = process.argv.includes('--apply')

const user = await prisma.user.findUnique({ where: { email: 'cmunoz@ingegarchile.cl' }, select: { id: true, name: true, role: true, technicianId: true } })
const tech = await prisma.technician.findFirst({ where: { name: 'Cristian Muñoz' }, select: { id: true, name: true, contractType: true, active: true } })

if (!user) { console.log('No se encontró el User cmunoz@ingegarchile.cl'); process.exit(1) }
if (!tech) { console.log('No se encontró el Technician "Cristian Muñoz"'); process.exit(1) }

console.log(`User: ${user.name} (${user.role}) — technicianId actual: ${user.technicianId ?? 'NULL'}`)
console.log(`Technician: ${tech.name} — contractType=${tech.contractType} active=${tech.active} — id=${tech.id}`)

if (user.technicianId === tech.id) {
  console.log('✓ Ya estaban enlazados — nada que hacer.')
  process.exit(0)
}
if (user.technicianId) {
  console.log(`⚠ El User ya tiene otro technicianId (${user.technicianId}) — no se sobreescribe automáticamente. Revisar a mano.`)
  process.exit(1)
}

if (!APPLY) {
  console.log(`\n[DRY RUN] Se enlazaría User(${user.id}).technicianId = ${tech.id}. Corre con --apply para ejecutar.`)
} else {
  await prisma.user.update({ where: { id: user.id }, data: { technicianId: tech.id } })
  console.log('✓ Enlazado.')
}

await prisma.$disconnect()
