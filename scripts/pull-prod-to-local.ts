/**
 * Espejo de un solo sentido: Turso PRODUCCIÓN (solo lectura) → SQLite local
 * (prisma/dev.db). Nunca al revés — ver .claude/rules/production-safety.md.
 * Run via: npm run db:pull-prod
 *
 * El origen se lee de process.env.DATABASE_URL/TURSO_AUTH_TOKEN, poblados
 * por --env-file=.env.production.local (mismo patrón que db:migrate:prod /
 * db:seed:prod). El destino está HARDCODEADO a file:./prisma/dev.db, nunca
 * leído de process.env — así es estructuralmente imposible que este script
 * escriba a otro lado, sin importar cómo esté configurado el .env local.
 *
 * R2 es un solo bucket compartido entre local y prod (mismos
 * R2_ACCOUNT_ID/R2_BUCKET en .env y .env.production.local) — los archivos
 * no se copian, las referencias (fileKey) ya resuelven contra el bucket
 * real tal cual.
 */
import { copyFileSync, existsSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const LOCAL_DB_PATH = 'prisma/dev.db'
const LOCAL_URL = `file:./${LOCAL_DB_PATH}`
const DEV_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Ingegar@Super1'

async function main() {
  // Guardia estructural: LOCAL_URL es un literal de arriba, no viene de env
  // — esto nunca debería poder fallar, pero si algún día alguien lo cambia
  // por error a algo derivado de env, esto lo frena antes de tocar nada.
  if (!LOCAL_URL.startsWith('file:')) {
    throw new Error('LOCAL_URL no es file: — abortando sin tocar nada.')
  }

  const prodUrl = process.env.DATABASE_URL
  const prodToken = process.env.TURSO_AUTH_TOKEN
  if (!prodUrl?.startsWith('libsql://') || !prodToken) {
    console.error('❌  DATABASE_URL debe ser libsql:// y TURSO_AUTH_TOKEN debe existir.')
    console.error('    Corré con: npm run db:pull-prod (ya usa --env-file=.env.production.local)')
    process.exit(1)
  }

  const prod = new PrismaClient({ adapter: new PrismaLibSql({ url: prodUrl, authToken: prodToken }) })
  const local = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: LOCAL_URL }) })

  if (existsSync(LOCAL_DB_PATH)) {
    copyFileSync(LOCAL_DB_PATH, `${LOCAL_DB_PATH}.bak`)
    console.log(`✓ Backup: ${LOCAL_DB_PATH}.bak`)
  }

  async function copyTable<T>(
    label: string,
    source: { findMany: () => Promise<T[]> },
    dest: { deleteMany: () => Promise<unknown>; createMany: (args: { data: T[] }) => Promise<unknown> },
  ) {
    const rows = await source.findMany()
    await dest.deleteMany()
    if (rows.length) await dest.createMany({ data: rows })
    console.log(`  ${label}: ${rows.length}`)
  }

  console.log('\n📥 Copiando tablas (prod → local)…')
  // Orden padre→hijo solo por legibilidad — FK checks quedan OFF durante la
  // carga, así que el orden real de delete/insert no importa acá.
  await local.$executeRawUnsafe('PRAGMA foreign_keys = OFF')
  try {
    await copyTable('Tenant', prod.tenant, local.tenant)
    await copyTable('User', prod.user, local.user)
    await copyTable('Client', prod.client, local.client)
    await copyTable('ClientRut', prod.clientRut, local.clientRut)
    await copyTable('Branch', prod.branch, local.branch)
    await copyTable('ClientDocument', prod.clientDocument, local.clientDocument)
    await copyTable('Technician', prod.technician, local.technician)
    await copyTable('TechnicianDocument', prod.technicianDocument, local.technicianDocument)
    await copyTable('Vehicle', prod.vehicle, local.vehicle)
    await copyTable('Asset', prod.asset, local.asset)
    await copyTable('Ticket', prod.ticket, local.ticket)
    await copyTable('TicketHistory', prod.ticketHistory, local.ticketHistory)
    await copyTable('TicketItem', prod.ticketItem, local.ticketItem)
    await copyTable('TicketDocument', prod.ticketDocument, local.ticketDocument)
    await copyTable('TicketCollaborator', prod.ticketCollaborator, local.ticketCollaborator)
    await copyTable('Job', prod.job, local.job)
    await copyTable('JobCost', prod.jobCost, local.jobCost)
    await copyTable('Assignment', prod.assignment, local.assignment)
    await copyTable('AssignmentAssignee', prod.assignmentAssignee, local.assignmentAssignee)
    await copyTable('Expense', prod.expense, local.expense)
    await copyTable('LeaveRequest', prod.leaveRequest, local.leaveRequest)
    await copyTable('Payroll', prod.payroll, local.payroll)
    await copyTable('SignatureRequest', prod.signatureRequest, local.signatureRequest)
    await copyTable('CompanyDocument', prod.companyDocument, local.companyDocument)
    await copyTable('Notification', prod.notification, local.notification)
    await copyTable('PushSubscription', prod.pushSubscription, local.pushSubscription)
  } finally {
    await local.$executeRawUnsafe('PRAGMA foreign_keys = ON')
  }

  // Sin esto, el espejo trae emails/usuarios reales pero nadie puede
  // loguearse en local sin saber la password real de cada persona — se
  // pisa por la misma password de seed ya documentada (se guarda como hash,
  // igual que hace prisma/seed.ts — nunca en texto plano).
  const devHash = await bcrypt.hash(DEV_PASSWORD, 10)
  const { count } = await local.user.updateMany({ data: { passwordHash: devHash } })
  console.log(`\n✓ ${count} passwords reseteadas a la password de dev ("${DEV_PASSWORD}")`)

  await prod.$disconnect()
  await local.$disconnect()
  console.log('✅ Listo — local es ahora un espejo de solo-lectura de producción.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
