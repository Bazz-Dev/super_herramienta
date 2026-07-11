/**
 * Idempotent: sets Carolina as isClientAdmin + creates 13 branch user accounts for JB.
 * Branches must already exist (created via import-jb-tickets.ts).
 * Run: npm run setup:jb:branches:prod
 */
import { PrismaClient } from '../src/generated/prisma/client.js'
import { createPrismaAdapter } from '../src/lib/db-adapter.js'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL!
if (!url?.startsWith('libsql://')) { console.error('Need libsql:// DATABASE_URL'); process.exit(1) }

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

const jb = await prisma.client.findFirst({ where: { portalSlug: 'justburger' } })
if (!jb) { console.error('JB client not found'); process.exit(1) }
console.log('✅ JB client:', jb.id)

const ingegar = await prisma.tenant.findUnique({ where: { id: jb.tenantId } })
if (!ingegar) { console.error('Tenant not found'); process.exit(1) }

// ── 1. Fix Carolina: isClientAdmin = true ────────────────────────────────────
const carolinaPass = process.env.SEED_CAROLINA_PASSWORD ?? 'Carolina@JB2026'
await prisma.user.upsert({
  where: { email: 'carolina@justburger.cl' },
  update: { isClientAdmin: true, active: true },
  create: {
    email: 'carolina@justburger.cl',
    name: 'Carolina Just Burger',
    passwordHash: await bcrypt.hash(carolinaPass, 10),
    role: 'client',
    tenantId: ingegar.id,
    clientId: jb.id,
    isClientAdmin: true,
  },
})
console.log('✅ Carolina → isClientAdmin: true')

// ── 2. Branch user accounts ───────────────────────────────────────────────────
const branchPassword = process.env.SEED_JB_BRANCH_PASSWORD ?? 'JBSucursal@2026'
const branchHash = await bcrypt.hash(branchPassword, 10)

const BRANCHES: { email: string; name: string; branchName: string }[] = [
  { email: 'quilin@justburger.cl',      name: 'Tienda Mall Paseo Quilín',  branchName: 'Tienda Mall Paseo Quilín' },
  { email: 'machali@justburger.cl',     name: 'Tienda Machalí',            branchName: 'Tienda Machalí' },
  { email: 'providencia@justburger.cl', name: 'Tienda Providencia',        branchName: 'Tienda Providencia' },
  { email: 'rotonda@justburger.cl',     name: 'Tienda Rotonda Atenas',     branchName: 'Tienda Rotonda Atenas' },
  { email: 'montt@justburger.cl',       name: 'Tienda Manuel Montt',       branchName: 'Tienda Manuel Montt' },
  { email: 'toesca@justburger.cl',      name: 'Tienda Toesca',             branchName: 'Tienda Toesca' },
  { email: 'vina@justburger.cl',        name: 'Tienda Viña del Mar',       branchName: 'Tienda Viña del Mar' },
  { email: 'huechuraba@justburger.cl',  name: 'Tienda Huechuraba',         branchName: 'Tienda Huechuraba' },
  { email: 'vallemana@justburger.cl',   name: 'Tienda Villa Alemana',      branchName: 'Tienda Villa Alemana' },
  { email: 'lareina@justburger.cl',     name: 'Tienda La Reina',           branchName: 'Tienda La Reina' },
  { email: 'isidora@justburger.cl',     name: 'Tienda Isidora',            branchName: 'Tienda Isidora' },
  { email: 'tranqueras@justburger.cl',  name: 'Tienda Tranqueras',         branchName: 'Tienda Tranqueras' },
  { email: 'laflorida@justburger.cl',   name: 'Tienda La Florida',         branchName: 'Tienda La Florida' },
]

let created = 0
let updated = 0

for (const b of BRANCHES) {
  const branch = await prisma.branch.findFirst({
    where: { clientId: jb.id, name: b.branchName },
    select: { id: true },
  })

  if (!branch) {
    console.warn(`⚠️  Branch not found: "${b.branchName}" — skipping ${b.email}`)
    continue
  }

  const existing = await prisma.user.findUnique({ where: { email: b.email } })
  if (existing) {
    await prisma.user.update({
      where: { email: b.email },
      data: { branchId: branch.id, clientId: jb.id, active: true, isClientAdmin: false },
    })
    updated++
    console.log(`  ↻ updated  ${b.email} → branch ${branch.id.slice(0, 8)}`)
  } else {
    await prisma.user.create({
      data: {
        email: b.email,
        name: b.name,
        passwordHash: branchHash,
        role: 'client',
        tenantId: ingegar.id,
        clientId: jb.id,
        branchId: branch.id,
        isClientAdmin: false,
      },
    })
    created++
    console.log(`  ✅ created  ${b.email} → branch ${branch.id.slice(0, 8)}`)
  }
}

console.log(`\n🎉 Setup completo: ${created} creados, ${updated} actualizados`)
console.log(`   Carolina admin: carolina@justburger.cl / ${carolinaPass}`)
console.log(`   Sucursales: <email>@justburger.cl / ${branchPassword}`)
await prisma.$disconnect()
