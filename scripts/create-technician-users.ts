/**
 * Creates User accounts for technicians who don't have one yet.
 * Run against LOCAL:  npx tsx --env-file=.env scripts/create-technician-users.ts
 * Run against PROD:   npm run users:tecnico:prod
 *
 * Outputs generated credentials so they can be shared with the technicians.
 */
import { prisma } from '../src/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

function slug(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '')
}

// Technicians to provision — name must match exactly as stored in DB
const TO_PROVISION = [
  { name: 'Juan Jesus Diaz',  username: 'jjdiaz',    password: 'Ingegar2024!' },
  { name: 'Jesus Gonzalez',   username: 'jgonzalez', password: 'Ingegar2024!' },
]

const tenant = await prisma.tenant.findFirst({ where: { slug: 'ingegar' }, select: { id: true } })
if (!tenant) { console.error('❌ Tenant ingegar no encontrado'); process.exit(1) }

console.log('\n🔧 Provisionando usuarios técnicos...\n')

for (const spec of TO_PROVISION) {
  // Find technician by name (case-insensitive)
  // SQLite doesn't support mode: 'insensitive' — find all and filter in JS
  const allTechs = await prisma.technician.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, name: true },
  })
  const tech = allTechs.find(t => t.name.toLowerCase().includes(spec.name.toLowerCase().split(' ')[1] ?? spec.name.toLowerCase()))

  if (!tech) {
    console.log(`⚠️  Técnico "${spec.name}" no encontrado en DB — verifica el nombre exacto`)
    // List available technicians
    const all = await prisma.technician.findMany({ where: { tenantId: tenant.id }, select: { name: true }, orderBy: { name: 'asc' } })
    console.log(`   Técnicos disponibles: ${all.map(t => t.name).join(', ')}`)
    continue
  }

  // Check if user already linked
  const existing = await prisma.user.findFirst({
    where: { technicianId: tech.id },
    select: { id: true, username: true },
  })

  if (existing) {
    console.log(`✓  ${tech.name} ya tiene usuario (username: ${existing.username})`)
    continue
  }

  // Check username collision
  const taken = await prisma.user.findFirst({ where: { username: spec.username }, select: { id: true } })
  const username = taken ? `${spec.username}2` : spec.username

  const passwordHash = await bcrypt.hash(spec.password, 12)
  const email = `${username}@ingegarchile.cl`

  const user = await prisma.user.create({
    data: {
      name: tech.name,
      email,
      username,
      passwordHash,
      role: 'tecnico',
      active: true,
      tenantId: tenant.id,
      technicianId: tech.id,
    },
  })

  console.log(`✅  ${tech.name}`)
  console.log(`    Usuario:    ${username}`)
  console.log(`    Email:      ${email}`)
  console.log(`    Contraseña: ${spec.password}`)
  console.log(`    Rol:        técnico`)
  console.log(`    ID usuario: ${user.id}`)
  console.log()
}

await prisma.$disconnect()
console.log('✅ Listo. Guarda las credenciales en un lugar seguro.')
