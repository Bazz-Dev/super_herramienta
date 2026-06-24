import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { createPrismaAdapter } from '../src/lib/db-adapter.js'
import bcrypt from 'bcryptjs'

// Adapter chosen from DATABASE_URL: local file (better-sqlite3) or Turso (libSQL).
const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

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

  // --- Users ---
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ingegar123'
  const adminHash = await bcrypt.hash(adminPassword, 10)

  // System super admin
  await prisma.user.upsert({
    where: { email: 'admin@ingegarchile.cl' },
    update: { passwordHash: adminHash, role: 'super', name: 'Admin INGEGAR', active: true },
    create: {
      email: 'admin@ingegarchile.cl',
      name: 'Admin INGEGAR',
      passwordHash: adminHash,
      role: 'super',
      tenantId: ingegar.id,
    },
  })

  // Sebastián Garrido — Gerente de Operaciones (super: ve todos los tenants igual que admin)
  const sebastianPassword = process.env.SEED_SEBASTIAN_PASSWORD ?? 'Ingegar@2026'
  const sebastianHash = await bcrypt.hash(sebastianPassword, 10)
  await prisma.user.upsert({
    where: { email: 'sgarrido@ingegarchile.cl' },
    update: { passwordHash: sebastianHash, role: 'super', name: 'Sebastián Garrido', active: true },
    create: {
      email: 'sgarrido@ingegarchile.cl',
      name: 'Sebastián Garrido',
      passwordHash: sebastianHash,
      role: 'super',
      tenantId: ingegar.id,
    },
  })

  // Cristian — Analista Comercial (supervisor: ve y edita datos de INGEGAR)
  const cristianPassword = process.env.SEED_CRISTIAN_PASSWORD ?? 'Ingegar@Comercial1'
  const cristianHash = await bcrypt.hash(cristianPassword, 10)
  await prisma.user.upsert({
    where: { email: 'cristian@ingegarchile.cl' },
    update: { passwordHash: cristianHash, role: 'supervisor', name: 'Cristian INGEGAR', active: true },
    create: {
      email: 'cristian@ingegarchile.cl',
      name: 'Cristian INGEGAR',
      passwordHash: cristianHash,
      role: 'supervisor',
      tenantId: ingegar.id,
    },
  })

  const password = adminPassword // for log below

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

    await prisma.crew.create({
      data: {
        name: 'Cuadrilla A',
        description: 'Mantención salas limpias',
        tenantId: ingegar.id,
        technicians: { connect: [{ id: techs[0].id }, { id: techs[2].id }] },
      },
    })

    // Camioneta de Carlos + su inventario (herramienta a bordo).
    const vehicle = await prisma.vehicle.create({
      data: {
        plate: 'GJKL-45',
        brand: 'Toyota',
        model: 'Hilux',
        year: 2022,
        status: 'active',
        tenantId: ingegar.id,
        technicianId: techs[0].id,
      },
    })

    await prisma.asset.create({
      data: {
        name: 'Contador de partículas',
        code: 'INV-001',
        category: 'Instrumento',
        status: 'in_use',
        tenantId: ingegar.id,
        vehicleId: vehicle.id,
      },
    })

    const client = await prisma.client.create({
      data: { name: 'Alcon Laboratorios Chile', rut: '96.789.000-1', tenantId: ingegar.id },
    })

    await prisma.assignment.create({
      data: {
        title: 'Mantención UMA — Alcon',
        start: new Date('2026-06-15T09:00:00'),
        end: new Date('2026-06-15T17:00:00'),
        status: 'scheduled',
        permissionRequested: true,
        tenantId: ingegar.id,
        clientId: client.id,
        assignees: {
          create: [
            { technicianId: techs[0].id, role: 'tecnico' },
            { technicianId: techs[2].id, role: 'ayudante' },
          ],
        },
      },
    })
  }

  // --- Enrich existing data to the v3 shape (idempotent, non-destructive) ---
  const firstTech = await prisma.technician.findFirst({ where: { tenantId: ingegar.id }, orderBy: { name: 'asc' } })
  if (firstTech) {
    let vehicle = await prisma.vehicle.findFirst({ where: { tenantId: ingegar.id } })
    if (!vehicle) {
      vehicle = await prisma.vehicle.create({
        data: { plate: 'GJKL-45', brand: 'Toyota', model: 'Hilux', year: 2022, status: 'active', tenantId: ingegar.id, technicianId: firstTech.id },
      })
    }
    const orphanAsset = await prisma.asset.findFirst({ where: { tenantId: ingegar.id, vehicleId: null } })
    if (orphanAsset) await prisma.asset.update({ where: { id: orphanAsset.id }, data: { vehicleId: vehicle.id } })
  }

  let client = await prisma.client.findFirst({ where: { tenantId: ingegar.id } })
  if (!client) {
    client = await prisma.client.create({ data: { name: 'Alcon Laboratorios Chile', rut: '96.789.000-1', tenantId: ingegar.id } })
  }
  // Make sure the demo assignment has a client + a team, if it lost them in the migration.
  const demoAssignment = await prisma.assignment.findFirst({
    where: { tenantId: ingegar.id },
    include: { _count: { select: { assignees: true } } },
  })
  if (demoAssignment) {
    if (!demoAssignment.clientId) {
      await prisma.assignment.update({ where: { id: demoAssignment.id }, data: { clientId: client.id, permissionRequested: true } })
    }
    if (demoAssignment._count.assignees === 0) {
      const teamTechs = await prisma.technician.findMany({ where: { tenantId: ingegar.id }, orderBy: { name: 'asc' }, take: 2 })
      await prisma.assignmentAssignee.createMany({
        data: teamTechs.map((t, i) => ({ assignmentId: demoAssignment.id, technicianId: t.id, role: i === 0 ? 'tecnico' : 'ayudante' })),
      })
    }
  }

  console.log('Seed complete.')
  console.log('  Tenants:', tenants.map((t) => t.slug).join(', '))
  console.log('  admin@ingegarchile.cl  /', password, '(super)')
  console.log('  sgarrido@ingegarchile.cl /', sebastianPassword, '(super — Gerente Operaciones)')
  console.log('  cristian@ingegarchile.cl /', cristianPassword, '(supervisor — Analista Comercial)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
