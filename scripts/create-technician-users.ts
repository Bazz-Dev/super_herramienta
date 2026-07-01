/**
 * Crea/actualiza cuentas de usuario para técnicos que no tienen una.
 * Idempotente: si el técnico ya tiene usuario, muestra sus credenciales sin modificarlas.
 *
 * Run LOCAL:  npx tsx --env-file=.env scripts/create-technician-users.ts
 * Run PROD:   npm run users:tecnico:prod
 *             (requiere .env.production.local con DATABASE_URL + TURSO_AUTH_TOKEN)
 */
import { prisma } from '../src/lib/prisma.js'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────────────────────────────────────────
// Lista de técnicos a provisionar.
// "search" es una cadena que debe estar contenida (case-insensitive) en el
// nombre del técnico tal como está guardado en la DB.
// ─────────────────────────────────────────────────────────────────────────────
const TO_PROVISION: Array<{
  search: string       // fragmento del nombre para buscar en DB
  username: string     // nick de login
  password: string     // contraseña inicial
}> = [
  { search: 'jesus',      username: 'jesus',      password: 'Tecnico@2026' },
  { search: 'gonzalez',   username: 'jgonzalez',  password: 'Ingegar2024!' },
]

// ─────────────────────────────────────────────────────────────────────────────

const tenant = await prisma.tenant.findFirst({
  where: { slug: 'ingegar' },
  select: { id: true },
})
if (!tenant) { console.error('❌ Tenant "ingegar" no encontrado'); process.exit(1) }

const allTechs = await prisma.technician.findMany({
  where: { tenantId: tenant.id },
  select: { id: true, name: true, active: true },
  orderBy: { name: 'asc' },
})

console.log(`\n🔧 Provisionando usuarios técnicos en tenant ingegar...\n`)
console.log(`   Técnicos en DB (${allTechs.length}): ${allTechs.map(t => t.name).join(', ')}\n`)

for (const spec of TO_PROVISION) {
  const term = spec.search.toLowerCase()
  const tech = allTechs.find(t => t.name.toLowerCase().includes(term))

  if (!tech) {
    console.log(`⚠️  No se encontró técnico que coincida con "${spec.search}"`)
    console.log(`   Nombres disponibles: ${allTechs.map(t => t.name).join(', ')}\n`)
    continue
  }

  // Check if already linked to a user
  const existing = await prisma.user.findFirst({
    where: { technicianId: tech.id },
    select: { id: true, email: true, username: true, active: true },
  })

  if (existing) {
    console.log(`✓  ${tech.name} ya tiene cuenta:`)
    console.log(`   nick: ${existing.username ?? '—'}  email: ${existing.email}  activo: ${existing.active}\n`)
    continue
  }

  // Guard: username collision
  const taken = await prisma.user.findFirst({ where: { username: spec.username }, select: { id: true } })
  const username = taken ? `${spec.username}2` : spec.username
  const email = `${username}@ingegarchile.cl`

  const passwordHash = await bcrypt.hash(spec.password, 12)
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
  console.log(`    nick:       ${username}`)
  console.log(`    email:      ${email}`)
  console.log(`    contraseña: ${spec.password}`)
  console.log(`    userId:     ${user.id}\n`)
}

await prisma.$disconnect()
console.log('✅ Listo.\n')
