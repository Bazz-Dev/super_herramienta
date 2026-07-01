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
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Ingegar@Super1'
  const adminHash = await bcrypt.hash(adminPassword, 10)

  await prisma.user.upsert({
    where: { email: 'admin@ingegarchile.cl' },
    update: { passwordHash: adminHash, role: 'super', name: 'Admin INGEGAR', active: true, username: 'ingegar' },
    create: { email: 'admin@ingegarchile.cl', username: 'ingegar', name: 'Admin INGEGAR', passwordHash: adminHash, role: 'super', tenantId: ingegar.id },
  })

  // Sebastián Garrido — Gerente de Operaciones
  const sebastianPassword = process.env.SEED_SEBASTIAN_PASSWORD ?? 'Ingegar@Ops1'
  const sebastianHash = await bcrypt.hash(sebastianPassword, 10)
  await prisma.user.upsert({
    where: { email: 'sgarrido@ingegarchile.cl' },
    update: { passwordHash: sebastianHash, role: 'supervisor', name: 'Sebastián Garrido', active: true, username: 'sgarrido' },
    create: { email: 'sgarrido@ingegarchile.cl', username: 'sgarrido', name: 'Sebastián Garrido', passwordHash: sebastianHash, role: 'supervisor', tenantId: ingegar.id },
  })

  // Cristian — Analista Comercial
  const cristianPassword = process.env.SEED_CRISTIAN_PASSWORD ?? 'Ingegar@Com1'
  const cristianHash = await bcrypt.hash(cristianPassword, 10)
  await prisma.user.upsert({
    where: { email: 'cristian@ingegarchile.cl' },
    update: { passwordHash: cristianHash, role: 'supervisor', name: 'Cristian INGEGAR', active: true, username: 'cristian' },
    create: { email: 'cristian@ingegarchile.cl', username: 'cristian', name: 'Cristian INGEGAR', passwordHash: cristianHash, role: 'supervisor', tenantId: ingegar.id },
  })

  // --- Recursos demo (solo si la BD está vacía) ---
  const techCount = await prisma.technician.count({ where: { tenantId: ingegar.id } })
  let firstDemoTech: { id: string; name: string } | null = null
  if (techCount === 0) {
    const techs = await Promise.all(
      [
        { name: 'Jesús Díaz', specialty: 'Climatización', phone: '+56 9 1111 1111' },
        { name: 'Marcela Rojas', specialty: 'Eléctrica', phone: '+56 9 2222 2222' },
        { name: 'Diego Soto', specialty: 'Mecánica', phone: '+56 9 3333 3333' },
      ].map((t) => prisma.technician.create({ data: { ...t, tenantId: ingegar.id } })),
    )
    firstDemoTech = techs[0]

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

  // --- Usuario técnico demo (Jesús Díaz) ---
  // Find by name, rename if DB had old Carlos Fuentes entry
  let jesusTech = firstDemoTech
    ?? await prisma.technician.findFirst({ where: { tenantId: ingegar.id, name: 'Jesús Díaz' } })
    ?? await prisma.technician.findFirst({ where: { tenantId: ingegar.id, name: 'Carlos Fuentes' } })

  if (jesusTech?.name === 'Carlos Fuentes') {
    jesusTech = await prisma.technician.update({
      where: { id: jesusTech.id },
      data: { name: 'Jesús Díaz' },
    })
  }

  if (jesusTech) {
    const tecnicoPassword = process.env.SEED_TECNICO_PASSWORD ?? 'Tecnico@2026'
    const tecnicoHash = await bcrypt.hash(tecnicoPassword, 10)
    await prisma.user.upsert({
      where: { email: 'jesus@ingegarchile.cl' },
      update: { passwordHash: tecnicoHash, role: 'tecnico', name: 'Jesús Díaz', technicianId: jesusTech.id, username: 'jesus' },
      create: {
        email: 'jesus@ingegarchile.cl',
        username: 'jesus',
        name: 'Jesús Díaz',
        passwordHash: tecnicoHash,
        role: 'tecnico',
        tenantId: ingegar.id,
        technicianId: jesusTech.id,
      },
    })
    // Remove old carlos account if it lingered
    await prisma.user.deleteMany({ where: { email: 'carlos@ingegarchile.cl' } })
    console.log('  jesus / jesus@ingegarchile.cl      /', tecnicoPassword, '(tecnico — Jesús Díaz)')
  }

  // --- Portales cliente (Just Burger + Decathlon) ---
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
    update: { passwordHash: jbHash, role: 'client', name: 'Portal Just Burger', clientId: jbClient.id, username: 'justburger' },
    create: {
      email: 'portal@justburger.cl',
      username: 'justburger',
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
    update: { passwordHash: decHash, role: 'client', name: 'Portal Decathlon', clientId: decClient.id, username: 'decathlon' },
    create: {
      email: 'portal@decathlon.cl',
      username: 'decathlon',
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

  console.log('\n✅ Seed completo — usuarios y credenciales:')
  console.log('\n  Usuario (nick / email)                Contraseña          Rol')
  console.log('  ─────────────────────────────────────────────────────────────────────')
  console.log(`  ingegar  / admin@ingegarchile.cl       ${adminPassword.padEnd(20)} super`)
  console.log(`  sgarrido / sgarrido@ingegarchile.cl    ${sebastianPassword.padEnd(20)} supervisor`)
  console.log(`  cristian / cristian@ingegarchile.cl    ${cristianPassword.padEnd(20)} supervisor`)
  console.log(`  jesus    / jesus@ingegarchile.cl       Tecnico@2026         tecnico`)
  console.log('\n  Portales cliente:')
  console.log(`  justburger / portal@justburger.cl      ${jbPassword.padEnd(20)} → /portal/justburger`)
  console.log(`  decathlon  / portal@decathlon.cl       ${decPassword.padEnd(20)} → /portal/decathlon`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
