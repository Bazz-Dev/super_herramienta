/**
 * Read-only follow-up: busca TODAS las cuentas (cualquier rol) que
 * contengan "cristian"/"crist" o "jesus"/"jesú" en el nombre, para
 * detectar duplicados que el primer audit pudo no capturar.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/audit-cristian-jesus.ts
 */
import { prisma } from '../src/lib/prisma.js'

console.log('=== Todas las cuentas con "crist" en el nombre (cualquier rol) ===')
const cristianUsers = await prisma.user.findMany({
  where: { name: { contains: 'rist' } },
  select: { id: true, name: true, email: true, role: true, active: true, technicianId: true, createdAt: true },
})
for (const u of cristianUsers) {
  console.log(`id=${u.id} name="${u.name}" role=${u.role} active=${u.active} email=${u.email} technicianId=${u.technicianId ?? 'NULL'} createdAt=${u.createdAt.toISOString()}`)
}

console.log('\n=== Todas las cuentas con "jesu"/"jesú" en el nombre (cualquier rol) ===')
const jesusUsers = await prisma.user.findMany({
  where: { OR: [{ name: { contains: 'jesu' } }, { name: { contains: 'Jesú' } }, { name: { contains: 'jesú' } }] },
  select: { id: true, name: true, email: true, role: true, active: true, technicianId: true, createdAt: true },
})
for (const u of jesusUsers) {
  console.log(`id=${u.id} name="${u.name}" role=${u.role} active=${u.active} email=${u.email} technicianId=${u.technicianId ?? 'NULL'} createdAt=${u.createdAt.toISOString()}`)
}

console.log('\n=== Todos los Technician con "crist" en el nombre ===')
const cristianTechs = await prisma.technician.findMany({
  where: { name: { contains: 'rist' } },
  select: { id: true, name: true, active: true, contractType: true, createdAt: true, user: { select: { id: true, email: true } } },
})
for (const t of cristianTechs) {
  console.log(`id=${t.id} name="${t.name}" active=${t.active} contractType=${t.contractType} createdAt=${t.createdAt.toISOString()} user=${t.user?.email ?? 'NULL'}`)
}

await prisma.$disconnect()
