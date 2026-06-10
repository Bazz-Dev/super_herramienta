import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  // --- Tenants ---
  const tenants = [
    { slug: 'ingegar', name: 'INGEGAR', brandHex: '#f5b100' },
    { slug: 'justburger', name: 'Just Burger', brandHex: '#e23b2e' },
    { slug: 'loficoffee', name: 'Lofi Coffee', brandHex: '#6f4e37' },
  ]

  for (const t of tenants) {
    await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: { name: t.name, brandHex: t.brandHex },
      create: t,
    })
  }

  const ingegar = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ingegar' } })

  // --- Super user (INGEGAR) ---
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ingegar123'
  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.user.upsert({
    where: { email: 'admin@ingegarchile.cl' },
    update: { passwordHash, role: 'super', name: 'Admin INGEGAR', active: true },
    create: {
      email: 'admin@ingegarchile.cl',
      name: 'Admin INGEGAR',
      passwordHash,
      role: 'super',
      tenantId: ingegar.id,
    },
  })

  // --- Sample resources (only if none exist for INGEGAR) ---
  const techCount = await prisma.technician.count({ where: { tenantId: ingegar.id } })
  if (techCount === 0) {
    const techs = await Promise.all(
      [
        { name: 'Carlos Fuentes', specialty: 'Climatización', phone: '+56 9 1111 1111' },
        { name: 'Marcela Rojas', specialty: 'Eléctrica', phone: '+56 9 2222 2222' },
        { name: 'Diego Soto', specialty: 'Mecánica', phone: '+56 9 3333 3333' },
      ].map((t) => prisma.technician.create({ data: { ...t, tenantId: ingegar.id } })),
    )

    const crew = await prisma.crew.create({
      data: {
        name: 'Cuadrilla A',
        description: 'Mantención salas limpias',
        tenantId: ingegar.id,
        technicians: { connect: [{ id: techs[0].id }, { id: techs[2].id }] },
      },
    })

    const asset = await prisma.asset.create({
      data: { name: 'Contador de partículas', code: 'INV-001', category: 'Instrumento', status: 'available', tenantId: ingegar.id },
    })

    await prisma.assignment.create({
      data: {
        title: 'Mantención UMA — Alcon',
        start: new Date('2026-06-15T09:00:00'),
        end: new Date('2026-06-15T17:00:00'),
        status: 'scheduled',
        tenantId: ingegar.id,
        crewId: crew.id,
        assetId: asset.id,
      },
    })
  }

  console.log('Seed complete.')
  console.log('  Tenants:', tenants.map((t) => t.slug).join(', '))
  console.log('  Super user: admin@ingegarchile.cl /', password)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
