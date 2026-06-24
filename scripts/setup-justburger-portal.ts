/**
 * One-time setup: configura el cliente Just Burger con portalSlug y crea
 * el usuario del portal (Carolina). Idempotente (upsert).
 * Run: npm run setup:jb:prod
 */
import { PrismaClient } from '../src/generated/prisma/client.js'
import { createPrismaAdapter } from '../src/lib/db-adapter.js'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL!
if (!url?.startsWith('libsql://')) { console.error('Need libsql:// DATABASE_URL'); process.exit(1) }

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

// ── 1. Buscar el tenant ingegar ───────────────────────────────────────────────
const ingegar = await prisma.tenant.findUnique({ where: { slug: 'ingegar' } })
if (!ingegar) { console.error('Tenant ingegar no encontrado'); process.exit(1) }
console.log('✅ Tenant ingegar:', ingegar.id)

// ── 2. Upsert cliente Just Burger ─────────────────────────────────────────────
const JB_THEME = JSON.stringify({
  primary: '#E52432',
  secondary: '#FFC107',
  bg: '#1a1a2e',
  card: '#16213e',
  text: '#e0e0e0',
})

let jb = await prisma.client.findFirst({
  where: { tenantId: ingegar.id, name: { contains: 'Just Burger' } },
})
if (jb) {
  jb = await prisma.client.update({
    where: { id: jb.id },
    data: { portalSlug: 'justburger', portalTheme: JB_THEME },
  })
} else {
  jb = await prisma.client.create({
    data: { tenantId: ingegar.id, name: 'Just Burger', portalSlug: 'justburger', portalTheme: JB_THEME },
  })
}
console.log('✅ Cliente Just Burger:', jb.id, '| portalSlug:', jb.portalSlug)

// ── 3. Upsert usuario portal Carolina ────────────────────────────────────────
const portalPassword = process.env.JB_PORTAL_PASSWORD ?? 'JustBurger@2026'
const hash = await bcrypt.hash(portalPassword, 10)

const carolina = await prisma.user.upsert({
  where: { email: 'carolina@justburger.cl' },
  update: { passwordHash: hash, role: 'client', clientId: jb.id, active: true },
  create: {
    email: 'carolina@justburger.cl',
    name: 'Carolina Just Burger',
    passwordHash: hash,
    role: 'client',
    tenantId: ingegar.id,
    clientId: jb.id,
  },
})
console.log('✅ Usuario portal:', carolina.email, '| clientId:', carolina.clientId)
console.log('\n🎉 Setup completo. Portal en: /portal/justburger')
console.log('   Login:', carolina.email, '/', portalPassword)

await prisma.$disconnect()
