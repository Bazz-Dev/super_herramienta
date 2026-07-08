/**
 * One-time setup: crea el portal Happyland en producción (Turso).
 * Idempotente — safe to re-run.
 * Run: npm run setup:hl:prod
 */
import { PrismaClient } from '../src/generated/prisma/client.js'
import { createPrismaAdapter } from '../src/lib/db-adapter.js'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL!
if (!url?.startsWith('libsql://')) { console.error('Need libsql:// DATABASE_URL'); process.exit(1) }

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

// ── 1. Tenant ingegar ─────────────────────────────────────────────────────────
const ingegar = await prisma.tenant.findUnique({ where: { slug: 'ingegar' } })
if (!ingegar) { console.error('Tenant ingegar no encontrado'); process.exit(1) }
console.log('✅ Tenant ingegar:', ingegar.id)

// ── 2. Upsert cliente Happyland ───────────────────────────────────────────────
const HL_THEME = JSON.stringify({ primary: '#FF5F2D' })

let hl = await prisma.client.findFirst({
  where: { tenantId: ingegar.id, portalSlug: 'happyland' },
})
if (hl) {
  hl = await prisma.client.update({
    where: { id: hl.id },
    data: { name: 'Happyland', portalSlug: 'happyland', portalTheme: HL_THEME },
  })
} else {
  hl = await prisma.client.create({
    data: {
      tenantId: ingegar.id,
      name: 'Happyland',
      portalSlug: 'happyland',
      portalTheme: HL_THEME,
      label: 'principal',
    },
  })
}
console.log('✅ Cliente Happyland:', hl.id, '| portalSlug:', hl.portalSlug)

// ── 3. Upsert sucursal demo ───────────────────────────────────────────────────
const hlBranch = await prisma.branch.upsert({
  where: { clientId_name: { clientId: hl.id, name: 'Parque Central' } },
  update: {},
  create: { name: 'Parque Central', city: 'Santiago', clientId: hl.id, tenantId: ingegar.id },
})
console.log('✅ Sucursal:', hlBranch.name, hlBranch.id)

// ── 4. Upsert usuario portal ──────────────────────────────────────────────────
const portalPassword = process.env.HL_PORTAL_PASSWORD ?? 'Happyland@2026'
const hash = await bcrypt.hash(portalPassword, 10)

const portalUser = await prisma.user.upsert({
  where: { email: 'portal@happyland.cl' },
  update: { passwordHash: hash, role: 'client', clientId: hl.id, active: true, name: 'Portal Happyland' },
  create: {
    email: 'portal@happyland.cl',
    username: 'happyland',
    name: 'Portal Happyland',
    passwordHash: hash,
    role: 'client',
    tenantId: ingegar.id,
    clientId: hl.id,
  },
})
console.log('✅ Usuario portal:', portalUser.email)

// ── 5. Usuario INGEGAR para createdBy ─────────────────────────────────────────
const adminUser = await prisma.user.findFirst({
  where: { tenantId: ingegar.id, role: 'super' },
  select: { id: true },
})
if (!adminUser) { console.error('No super user found in ingegar tenant'); process.exit(1) }

// ── 6. Crear 3 tickets demo (idempotente por ticketCode) ─────────────────────
const DEMO_TICKETS = [
  {
    ticketCode: 'HL-260101-RQ1-PARQUE',
    title: 'Revisión sistema de climatización sala de juegos principal',
    description: 'Se requiere revisión y mantención del sistema de aire acondicionado en la sala principal. Los equipos presentan ruido inusual y temperatura irregular.',
    urgency: 'urgencia' as const,
    status: 'en_revision' as const,
    category: 'Climatización',
  },
  {
    ticketCode: 'HL-260101-RQ2-PARQUE',
    title: 'Falla en iluminación sector infantil Zona A',
    description: 'Varios artefactos de iluminación LED en el sector infantil presentan intermitencia. Afecta la experiencia del cliente y requiere atención para cumplir normas de seguridad.',
    urgency: 'no_urgente' as const,
    status: 'nuevo' as const,
    category: 'Eléctrica',
  },
  {
    ticketCode: 'HL-260101-PR1-PARQUE',
    title: 'Mantención preventiva equipos de juego mecánicos',
    description: 'Mantención semestral programada para equipos mecánicos: revisión de motores, engranajes, sistemas de seguridad y lubricación. Incluye 12 equipos en total.',
    urgency: 'preventivo' as const,
    status: 'en_ejecucion' as const,
    category: 'Mecánica',
  },
]

for (const t of DEMO_TICKETS) {
  const existing = await prisma.ticket.findUnique({ where: { ticketCode: t.ticketCode }, select: { id: true, ticketCode: true } })
  if (existing) {
    console.log('⏭  Ticket ya existe:', existing.ticketCode)
    continue
  }
  const ticket = await prisma.ticket.create({
    data: {
      ticketCode: t.ticketCode,
      title: t.title,
      description: t.description,
      urgency: t.urgency as never,
      status: t.status as never,
      category: t.category,
      clientId: hl.id,
      branchId: hlBranch.id,
      tenantId: ingegar.id,
      createdById: adminUser.id,
      showToClient: true,
    },
  })
  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      userId: adminUser.id,
      toStatus: t.status,
      note: 'Requerimiento registrado por INGEGAR',
      isInternal: false,
    },
  })
  console.log('✅ Ticket creado:', ticket.ticketCode, '|', t.urgency, '|', t.status)
}

console.log('\n🎉 Setup Happyland completo.')
console.log('   Portal: /portal/happyland')
console.log('   Login:', portalUser.email, '/', portalPassword)

await prisma.$disconnect()
