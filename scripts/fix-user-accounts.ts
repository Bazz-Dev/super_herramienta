/**
 * Corrige y normaliza cuentas de usuario INGEGAR.
 * Idempotente — seguro de correr varias veces.
 *
 * Acciones:
 *  1. Renombra cristian → cmunoz, jesus → jdiaz, jgonzalez → jgonzales
 *  2. Desactiva cualquier cuenta que NO esté en la lista aprobada
 *     (excepto clientes del portal que se mantienen por rol)
 *
 * Run LOCAL:   npx tsx --env-file=.env scripts/fix-user-accounts.ts
 * Run PROD:    npm run users:fix:prod
 */
import { prisma } from '../src/lib/prisma.js'

const RENAMES: Array<{
  matchEmail?: string
  matchUsername?: string
  newEmail: string
  newUsername: string
  newName: string
}> = [
  {
    matchEmail: 'cristian@ingegarchile.cl',
    matchUsername: 'cristian',
    newEmail: 'cmunoz@ingegarchile.cl',
    newUsername: 'cmunoz',
    newName: 'Cristian Muñoz',
  },
  {
    matchEmail: 'jesus@ingegarchile.cl',
    matchUsername: 'jesus',
    newEmail: 'jdiaz@ingegarchile.cl',
    newUsername: 'jdiaz',
    newName: 'Juan Jesús Díaz',
  },
  {
    matchEmail: 'jgonzalez@ingegarchile.cl',
    matchUsername: 'jgonzalez',
    newEmail: 'jgonzales@ingegarchile.cl',
    newUsername: 'jgonzales',
    newName: 'Jesús González',
  },
]

// After renames, these are the ONLY approved non-client emails
const APPROVED_EMAILS = new Set([
  'admin@ingegarchile.cl',
  'sgarrido@ingegarchile.cl',
  'cmunoz@ingegarchile.cl',
  'jdiaz@ingegarchile.cl',
  'jgonzales@ingegarchile.cl',
])

console.log('\n👤 Fix user accounts\n')

// ─── 1. Renames ───────────────────────────────────────────────────────────────
for (const r of RENAMES) {
  const where = r.matchEmail
    ? { email: r.matchEmail }
    : { username: r.matchUsername }

  const user = await prisma.user.findFirst({ where: where as object, select: { id: true, email: true, username: true, name: true } })
  if (!user) {
    // Already renamed — verify target exists
    const target = await prisma.user.findFirst({ where: { email: r.newEmail }, select: { id: true } })
    if (target) {
      console.log(`✓  ${r.newEmail} ya existe (sin cambios)`)
    } else {
      console.log(`⚠️  No se encontró usuario para renombrar: ${r.matchEmail ?? r.matchUsername}`)
    }
    continue
  }

  if (user.email === r.newEmail && user.username === r.newUsername) {
    console.log(`✓  ${r.newEmail} ya tiene los datos correctos`)
    continue
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: r.newEmail,
      username: r.newUsername,
      name: r.newName,
    },
  })
  console.log(`✅  Renombrado: ${user.email} → ${r.newEmail} (nick: ${user.username} → ${r.newUsername})`)
}

// ─── 2. Deactivate non-approved non-client accounts ──────────────────────────
const allUsers = await prisma.user.findMany({
  select: { id: true, email: true, username: true, role: true, active: true },
})

console.log('\n🔍 Verificando cuentas…')
for (const u of allUsers) {
  if (u.role === 'client') continue // Portal clients always kept
  if (APPROVED_EMAILS.has(u.email ?? '')) continue

  if (u.active) {
    await prisma.user.update({ where: { id: u.id }, data: { active: false } })
    console.log(`🚫  Desactivado: ${u.email ?? u.username} (rol: ${u.role})`)
  } else {
    console.log(`—   Ya inactivo: ${u.email ?? u.username}`)
  }
}

// ─── 3. Summary ───────────────────────────────────────────────────────────────
const final = await prisma.user.findMany({
  select: { email: true, username: true, role: true, active: true },
  orderBy: [{ role: 'asc' }, { email: 'asc' }],
})

console.log('\n📋 Estado final:\n')
final.forEach(u => {
  const status = u.active ? '✅' : '🚫'
  console.log(`${status}  ${u.role.padEnd(12)} ${(u.username ?? '—').padEnd(14)} ${u.email}`)
})

await prisma.$disconnect()
console.log('\n✅ Listo.\n')
