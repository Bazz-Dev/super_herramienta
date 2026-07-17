import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { createPrismaAdapter } from '../src/lib/db-adapter.js'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({ adapter: createPrismaAdapter() })

// 🔒 G20: el seed escribe credenciales con defaults conocidos del repo.
// NUNCA debe correr contra producción de forma silenciosa: los defaults en prod
// son una brecha de seguridad (incidente 2026-07-16). Para un seed productivo
// intencional se exige el flag explícito Y todos los passwords por env.
const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
if (/^(libsql|https?|wss?):\/\//.test(dbUrl)) {
  if (process.env.SEED_ALLOW_PROD !== '1') {
    console.error('🚨 seed.ts: DATABASE_URL apunta a una base remota (producción).')
    console.error('   El seed usa passwords por defecto conocidos — prohibido en prod.')
    console.error('   Si es intencional: SEED_ALLOW_PROD=1 y define TODOS los SEED_*_PASSWORD.')
    process.exit(1)
  }
  const required = ['SEED_ADMIN_PASSWORD', 'SEED_JB_PASSWORD', 'SEED_CAROLINA_PASSWORD', 'SEED_JB_BRANCH_PASSWORD', 'SEED_DEC_PASSWORD', 'SEED_HL_PASSWORD', 'SEED_TECNICO_PASSWORD']
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`🚨 seed.ts contra prod sin passwords explícitos: faltan ${missing.join(', ')}`)
    process.exit(1)
  }
}

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

  const tecnicoPassword = process.env.SEED_TECNICO_PASSWORD ?? 'Tecnico@2026'
  const tecnicoHash = await bcrypt.hash(tecnicoPassword, 10)

  if (jesusTech) {
    // Remove any user that already owns this technicianId with a different email
    // (prevents P2002 unique constraint violation on technicianId during upsert)
    await prisma.user.deleteMany({
      where: { technicianId: jesusTech.id, NOT: { email: 'jesus@ingegarchile.cl' } },
    })
    // Clear any other user claiming the 'jesus' username
    await prisma.user.deleteMany({
      where: { username: 'jesus', NOT: { email: 'jesus@ingegarchile.cl' } },
    })
    await prisma.user.upsert({
      where: { email: 'jesus@ingegarchile.cl' },
      update: { passwordHash: tecnicoHash, role: 'tecnico', name: 'Jesús Díaz', technicianId: jesusTech.id, username: 'jesus', active: true },
      create: {
        email: 'jesus@ingegarchile.cl',
        username: 'jesus',
        name: 'Jesús Díaz',
        passwordHash: tecnicoHash,
        role: 'tecnico',
        tenantId: ingegar.id,
        technicianId: jesusTech.id,
        active: true,
      },
    })
  } else {
    // No matching technician found — still ensure the demo user exists and is active
    // (handles existing DBs where the technician was renamed or removed)
    await prisma.user.deleteMany({
      where: { username: 'jesus', NOT: { email: 'jesus@ingegarchile.cl' } },
    })
    await prisma.user.upsert({
      where: { email: 'jesus@ingegarchile.cl' },
      update: { passwordHash: tecnicoHash, role: 'tecnico', name: 'Jesús Díaz', username: 'jesus', active: true },
      create: {
        email: 'jesus@ingegarchile.cl',
        username: 'jesus',
        name: 'Jesús Díaz',
        passwordHash: tecnicoHash,
        role: 'tecnico',
        tenantId: ingegar.id,
        active: true,
      },
    })
  }
  // Remove old carlos account if it lingered
  await prisma.user.deleteMany({ where: { email: 'carlos@ingegarchile.cl' } })
  console.log('  jesus / jesus@ingegarchile.cl      /', tecnicoPassword, '(tecnico — Jesús Díaz)')

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

  // Carolina — Client Admin de Just Burger (aprueba tickets antes de llegar a INGEGAR)
  const carolinaPassword = process.env.SEED_CAROLINA_PASSWORD ?? 'Carolina@JB2026'
  const carolinaHash = await bcrypt.hash(carolinaPassword, 10)
  await prisma.user.upsert({
    where: { email: 'carolina@justburger.cl' },
    update: { passwordHash: carolinaHash, role: 'client', name: 'Carolina', clientId: jbClient.id, username: 'jb.carolina', isClientAdmin: true, active: true },
    create: {
      email: 'carolina@justburger.cl',
      username: 'jb.carolina',
      name: 'Carolina',
      passwordHash: carolinaHash,
      role: 'client',
      tenantId: ingegar.id,
      clientId: jbClient.id,
      isClientAdmin: true,
    },
  })

  // 13 sucursales Just Burger + usuarios por sucursal
  const jbBranches = [
    { slug: 'quilin',      name: 'Tienda Mall Paseo Quilín',  city: 'Santiago',   email: 'quilin@justburger.cl',       username: 'jb.quilin' },
    { slug: 'machali',     name: 'Tienda Machalí',            city: 'Machalí',    email: 'machali@justburger.cl',      username: 'jb.machali' },
    { slug: 'providencia', name: 'Tienda Providencia',        city: 'Santiago',   email: 'providencia@justburger.cl',  username: 'jb.providencia' },
    { slug: 'rotonda',     name: 'Tienda Rotonda Atenas',     city: 'Santiago',   email: 'rotonda@justburger.cl',      username: 'jb.rotonda' },
    { slug: 'montt',       name: 'Tienda Manuel Montt',       city: 'Santiago',   email: 'montt@justburger.cl',        username: 'jb.montt' },
    { slug: 'toesca',      name: 'Tienda Toesca',             city: 'Santiago',   email: 'toesca@justburger.cl',       username: 'jb.toesca' },
    { slug: 'vina',        name: 'Tienda Viña del Mar',       city: 'Viña del Mar', email: 'vina@justburger.cl',       username: 'jb.vina' },
    { slug: 'huechuraba',  name: 'Tienda Huechuraba',         city: 'Huechuraba', email: 'huechuraba@justburger.cl',   username: 'jb.huechuraba' },
    { slug: 'vallemana',   name: 'Tienda Villa Alemana',      city: 'Villa Alemana', email: 'vallemana@justburger.cl', username: 'jb.vallemana' },
    { slug: 'lareina',     name: 'Tienda La Reina',           city: 'La Reina',   email: 'lareina@justburger.cl',      username: 'jb.lareina' },
    { slug: 'isidora',     name: 'Tienda Isidora',            city: 'Santiago',   email: 'isidora@justburger.cl',      username: 'jb.isidora' },
    { slug: 'tranqueras',  name: 'Tienda Tranqueras',         city: 'Santiago',   email: 'tranqueras@justburger.cl',   username: 'jb.tranqueras' },
    { slug: 'laflorida',   name: 'Tienda La Florida',         city: 'La Florida', email: 'laflorida@justburger.cl',    username: 'jb.laflorida' },
  ]

  const jbBranchPassword = process.env.SEED_JB_BRANCH_PASSWORD ?? 'JBSucursal@2026'
  const jbBranchHash = await bcrypt.hash(jbBranchPassword, 10)

  for (const b of jbBranches) {
    const branch = await prisma.branch.upsert({
      where: { clientId_name: { clientId: jbClient.id, name: b.name } },
      update: { city: b.city, active: true },
      create: { name: b.name, city: b.city, clientId: jbClient.id, tenantId: ingegar.id, active: true },
    })
    await prisma.user.upsert({
      where: { email: b.email },
      update: { passwordHash: jbBranchHash, role: 'client', name: b.name, clientId: jbClient.id, username: b.username, branchId: branch.id, active: true },
      create: {
        email: b.email,
        username: b.username,
        name: b.name,
        passwordHash: jbBranchHash,
        role: 'client',
        tenantId: ingegar.id,
        clientId: jbClient.id,
        branchId: branch.id,
        active: true,
      },
    })
  }

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

  // --- Portal Happyland ---
  const hlPassword = process.env.SEED_HL_PASSWORD ?? 'Happyland@2026'
  const hlHash = await bcrypt.hash(hlPassword, 10)

  const hlClient = await prisma.client.upsert({
    where: { portalSlug: 'happyland' },
    update: { name: 'Happyland', portalTheme: JSON.stringify({ primary: '#FF5F2D' }) },
    create: {
      name: 'Happyland',
      tenantId: ingegar.id,
      portalSlug: 'happyland',
      portalTheme: JSON.stringify({ primary: '#FF5F2D' }),
      label: 'principal',
    },
  })

  await prisma.user.upsert({
    where: { email: 'portal@happyland.cl' },
    update: { passwordHash: hlHash, role: 'client', name: 'Portal Happyland', clientId: hlClient.id, username: 'happyland', active: true },
    create: {
      email: 'portal@happyland.cl',
      username: 'happyland',
      name: 'Portal Happyland',
      passwordHash: hlHash,
      role: 'client',
      tenantId: ingegar.id,
      clientId: hlClient.id,
    },
  })

  console.log('\n✅ Seed completo — usuarios y credenciales:')
  console.log('\n  INGEGAR staff:')
  console.log(`  ingegar  / admin@ingegarchile.cl       ${adminPassword.padEnd(20)} super`)
  console.log(`  sgarrido / sgarrido@ingegarchile.cl    ${sebastianPassword.padEnd(20)} supervisor`)
  console.log(`  cristian / cristian@ingegarchile.cl    ${cristianPassword.padEnd(20)} supervisor`)
  console.log(`  jesus    / jesus@ingegarchile.cl       Tecnico@2026         tecnico`)
  console.log('\n  Portales cliente (acceso general):')
  console.log(`  justburger  / portal@justburger.cl     ${jbPassword.padEnd(20)} → /portal/justburger`)
  console.log(`  decathlon   / portal@decathlon.cl      ${decPassword.padEnd(20)} → /portal/decathlon`)
  console.log(`  happyland   / portal@happyland.cl      ${hlPassword.padEnd(20)} → /portal/happyland`)
  console.log('\n  Just Burger — Admin cliente:')
  console.log(`  jb.carolina / carolina@justburger.cl   ${carolinaPassword.padEnd(20)} client-admin (aprueba tickets)`)
  console.log('\n  Just Burger — Usuarios por sucursal:')
  for (const b of jbBranches) {
    console.log(`  ${b.username.padEnd(16)} / ${b.email.padEnd(30)} ${jbBranchPassword.padEnd(20)} → ${b.name}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
