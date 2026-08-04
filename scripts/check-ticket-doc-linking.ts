/**
 * Read-only: cuantifica qué tan bien quedan vinculados los documentos
 * existentes (ClientDocument) y los trabajos (Job) a su Ticket de origen,
 * contra el espejo local (snapshot de prod vía db:pull-prod). Insumo directo
 * para la pestaña nueva de /conciliacion (informe #4/#9, sesión 2026-08-02).
 *
 * Run: npx tsx scripts/check-ticket-doc-linking.ts
 */
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:./prisma/dev.db' }) })

async function main() {
  const [
    totalTickets,
    totalPropuestas, propuestasSinTicket,
    totalInformes, informesSinTicket,
    totalJobs, jobsSinTicket, jobsSinTicketConMonto,
    ticketsSinDocs,
  ] = await Promise.all([
    prisma.ticket.count({ where: { deletedAt: null } }),
    prisma.clientDocument.count({ where: { type: 'propuesta' } }),
    prisma.clientDocument.count({ where: { type: 'propuesta', ticketId: null } }),
    prisma.clientDocument.count({ where: { type: 'informe' } }),
    prisma.clientDocument.count({ where: { type: 'informe', ticketId: null } }),
    prisma.job.count(),
    prisma.job.count({ where: { originTicketId: null } }),
    prisma.job.count({ where: { originTicketId: null, netAmount: { gt: 0 } } }),
    prisma.ticket.count({
      where: {
        deletedAt: null,
        otFileUrl: null,
        documents: { none: {} },
        // sin propuesta/informe vinculado tampoco
        AND: [
          { id: { notIn: (await prisma.clientDocument.findMany({ where: { ticketId: { not: null } }, select: { ticketId: true } })).map(d => d.ticketId!) } },
        ],
      },
    }),
  ])

  console.log('=== Documentos (ClientDocument) ===')
  console.log(`Propuestas: ${totalPropuestas} total, ${propuestasSinTicket} SIN ticket (${(100 * propuestasSinTicket / (totalPropuestas || 1)).toFixed(0)}%)`)
  console.log(`Informes:   ${totalInformes} total, ${informesSinTicket} SIN ticket (${(100 * informesSinTicket / (totalInformes || 1)).toFixed(0)}%)`)

  console.log('\n=== Trabajos (Job) ===')
  console.log(`Total: ${totalJobs}, sin originTicketId: ${jobsSinTicket} (${(100 * jobsSinTicket / (totalJobs || 1)).toFixed(0)}%)`)
  console.log(`De esos, con monto real (netAmount > 0): ${jobsSinTicketConMonto}`)

  console.log('\n=== Tickets ===')
  console.log(`Total activos (no eliminados): ${totalTickets}`)
  console.log(`Sin NINGÚN documento vinculado (ni OT, ni adjunto, ni propuesta, ni informe): ${ticketsSinDocs}`)

  // Muestra de los Jobs huérfanos con monto, para ver de qué época/cliente son
  const sample = await prisma.job.findMany({
    where: { originTicketId: null, netAmount: { gt: 0 } },
    select: { code: true, client: { select: { name: true } }, netAmount: true, executionDate: true, importRef: true },
    orderBy: { executionDate: 'desc' },
    take: 10,
  })
  console.log('\n=== Muestra de Jobs sin ticket, con monto (10 más recientes) ===')
  for (const j of sample) {
    console.log(`  ${j.code ?? j.importRef ?? '(sin código)'} · ${j.client.name} · $${j.netAmount} · ${j.executionDate?.toISOString().slice(0, 10) ?? 'sin fecha'}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
