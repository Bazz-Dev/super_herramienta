import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { createPrismaAdapter } from '../src/lib/db-adapter.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

async function main() {
  // INGEGAR es el único tenant de esta plataforma.
  // Just Burger, Decathlon y Unity son CLIENTES de INGEGAR (tabla clients),
  // no tenants separados. Se cargan vía: npm run import:flujo:prod
  const ingegar = await prisma.tenant.upsert({
    where: { slug: 'ingegar' },
    update: { name: 'INGEGAR', brandHex: '#f5b100' },
    create: { slug: 'ingegar', name: 'INGEGAR', brandHex: '#f5b100' },
  })

  // --- Usuarios ---
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ingegar123'
  const adminHash = await bcrypt.hash(adminPassword, 10)

  await prisma.user.upsert({
    where: { email: 'admin@ingegarchile.cl' },
    update: { passwordHash: adminHash, role: 'super', name: 'Admin INGEGAR', active: true },
    create: { email: 'admin@ingegarchile.cl', name: 'Admin INGEGAR', passwordHash: adminHash, role: 'super', tenantId: ingegar.id },
  })

  // Sebastián Garrido — Gerente de Operaciones
  const sebastianPassword = process.env.SEED_SEBASTIAN_PASSWORD ?? 'Ingegar@2026'
  const sebastianHash = await bcrypt.hash(sebastianPassword, 10)
  await prisma.user.upsert({
    where: { email: 'sgarrido@ingegarchile.cl' },
    update: { passwordHash: sebastianHash, role: 'super', name: 'Sebastián Garrido', active: true },
    create: { email: 'sgarrido@ingegarchile.cl', name: 'Sebastián Garrido', passwordHash: sebastianHash, role: 'super', tenantId: ingegar.id },
  })

  // Cristian — Analista Comercial
  const cristianPassword = process.env.SEED_CRISTIAN_PASSWORD ?? 'Ingegar@Comercial1'
  const cristianHash = await bcrypt.hash(cristianPassword, 10)
  await prisma.user.upsert({
    where: { email: 'cristian@ingegarchile.cl' },
    update: { passwordHash: cristianHash, role: 'supervisor', name: 'Cristian INGEGAR', active: true },
    create: { email: 'cristian@ingegarchile.cl', name: 'Cristian INGEGAR', passwordHash: cristianHash, role: 'supervisor', tenantId: ingegar.id },
  })

  // --- Recursos demo (solo si la BD está vacía) ---
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

    const vehicle = await prisma.vehicle.create({
      data: { plate: 'GJKL-45', brand: 'Toyota', model: 'Hilux', year: 2022, status: 'active', tenantId: ingegar.id, technicianId: techs[0].id },
    })

    await prisma.asset.create({
      data: { name: 'Contador de partículas', code: 'INV-001', category: 'Instrumento', status: 'in_use', tenantId: ingegar.id, vehicleId: vehicle.id },
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

  // Parche de consistencia: asegurar que la primera camioneta tenga técnico y activos vinculados
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

  // --- Portales cliente (Just Burger + Decathlon) ---
  // portalTheme solo guarda "primary"; bg/card/text son siempre hardcoded claros en resolvePortalTheme()
  const jbPassword = process.env.SEED_JB_PASSWORD ?? 'JustBurger@2026'
  const jbHash = await bcrypt.hash(jbPassword, 10)

  const jbClient = await prisma.client.upsert({
    where: { portalSlug: 'justburger' },
    update: { name: 'Just Burger', portalTheme: JSON.stringify({ primary: '#d42030' }) },
    create: {
      name: 'Just Burger',
      tenantId: ingegar.id,
      portalSlug: 'justburger',
      portalTheme: JSON.stringify({ primary: '#d42030' }),
      label: 'principal',
    },
  })

  await prisma.user.upsert({
    where: { email: 'portal@justburger.cl' },
    update: { passwordHash: jbHash, role: 'client', name: 'Portal Just Burger', clientId: jbClient.id },
    create: {
      email: 'portal@justburger.cl',
      name: 'Portal Just Burger',
      passwordHash: jbHash,
      role: 'client',
      tenantId: ingegar.id,
      clientId: jbClient.id,
    },
  })

  const decPassword = process.env.SEED_DEC_PASSWORD ?? 'Decathlon@2026'
  const decHash = await bcrypt.hash(decPassword, 10)

  const decClient = await prisma.client.upsert({
    where: { portalSlug: 'decathlon' },
    update: { name: 'Decathlon Chile', portalTheme: JSON.stringify({ primary: '#0082C3' }) },
    create: {
      name: 'Decathlon Chile',
      tenantId: ingegar.id,
      portalSlug: 'decathlon',
      portalTheme: JSON.stringify({ primary: '#0082C3' }),
      label: 'principal',
    },
  })

  await prisma.user.upsert({
    where: { email: 'portal@decathlon.cl' },
    update: { passwordHash: decHash, role: 'client', name: 'Portal Decathlon', clientId: decClient.id },
    create: {
      email: 'portal@decathlon.cl',
      name: 'Portal Decathlon',
      passwordHash: decHash,
      role: 'client',
      tenantId: ingegar.id,
      clientId: decClient.id,
    },
  })

  // Demo branch for Decathlon
  await prisma.branch.upsert({
    where: { clientId_name: { clientId: decClient.id, name: 'Las Condes' } },
    update: {},
    create: { name: 'Las Condes', city: 'Santiago', clientId: decClient.id, tenantId: ingegar.id },
  })

  console.log('\nSeed completo.')
  console.log('  Tenant único: ingegar')
  console.log('  admin@ingegarchile.cl         /', adminPassword, '(super)')
  console.log('  sgarrido@ingegarchile.cl      /', sebastianPassword, '(super — Gerente Operaciones)')
  console.log('  cristian@ingegarchile.cl      /', cristianPassword, '(supervisor — Analista Comercial)')
  console.log('\n  Portales cliente:')
  console.log('  portal@justburger.cl          /', jbPassword, '(client) → /portal/justburger')
  console.log('  portal@decathlon.cl           /', decPassword, '(client) → /portal/decathlon')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
