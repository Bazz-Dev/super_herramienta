/**
 * Reconciliación 2026 — reporte final consolidado + resumen, generados
 * contra el estado REAL actual de Turso (no re-parsea los CSV intermedios
 * de cada fase — más confiable leer la base directamente después de aplicar
 * todo). Solo lectura.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/reconcile-2026-final-report.ts
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'

function csvEscape(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

async function main() {
  console.log('=== REPORTE FINAL CONSOLIDADO (solo lectura) ===')

  const jobs = await prisma.job.findMany({
    select: {
      id: true, code: true, importRef: true, description: true, status: true, financialStage: true,
      originTicketId: true, docReport: true,
      client: { select: { name: true } },
      originTicket: { select: { ticketCode: true, otNumber: true, otFileUrl: true } },
    },
  })
  const tickets = await prisma.ticket.findMany({
    where: { deletedAt: null },
    select: { id: true, ticketCode: true, status: true, otNumber: true, otFileUrl: true, client: { select: { name: true } }, originJobs: { select: { id: true, code: true } } },
  })
  const ticketIdsWithReport = new Set(
    (await prisma.clientDocument.findMany({ where: { type: 'informe', ticketId: { not: null } }, select: { ticketId: true } })).map((d) => d.ticketId),
  )

  type Row = {
    source_ref: string; cliente: string; ticket_id: string; cashflow_id: string
    match_status: string; missing_ticket: string; missing_cashflow: string
    missing_ot: string; missing_it: string; requires_manual_action: string
  }
  const rows: Row[] = []

  for (const j of jobs) {
    const hasTicket = !!j.originTicketId
    const missingOt = hasTicket ? (!j.originTicket?.otFileUrl ? 'SI' : 'NO') : 'N/A'
    const missingIt = j.docReport ? (j.originTicketId && ticketIdsWithReport.has(j.originTicketId) ? 'NO' : 'SI') : 'NO'
    rows.push({
      source_ref: j.importRef ?? j.code ?? j.id,
      cliente: j.client.name,
      ticket_id: j.originTicket?.ticketCode ?? '',
      cashflow_id: j.code ?? j.id,
      match_status: hasTicket ? 'MATCHED' : 'MISSING_TICKET',
      missing_ticket: hasTicket ? 'NO' : 'SI',
      missing_cashflow: 'NO',
      missing_ot: missingOt,
      missing_it: missingIt,
      requires_manual_action: (!hasTicket || missingOt === 'SI' || missingIt === 'SI') ? 'SI' : 'NO',
    })
  }
  for (const t of tickets) {
    if (t.originJobs.length > 0) continue // ya cubierto arriba desde el lado Job
    rows.push({
      source_ref: '', cliente: t.client.name, ticket_id: t.ticketCode, cashflow_id: '',
      match_status: 'MISSING_CASHFLOW',
      missing_ticket: 'NO', missing_cashflow: 'SI',
      missing_ot: t.otFileUrl ? 'NO' : 'SI',
      missing_it: ticketIdsWithReport.has(t.id) ? 'NO' : 'SI',
      requires_manual_action: 'SI',
    })
  }

  const header = 'source_ref,cliente,ticket_id,cashflow_id,match_status,missing_ticket,missing_cashflow,missing_ot,missing_it,requires_manual_action'
  writeFileSync('backups/reconciliation-report.csv', [header, ...rows.map((r) => Object.values(r).map(csvEscape).join(','))].join('\n'))

  const summary = {
    generado: new Date().toISOString(),
    just_burger_tickets_total: tickets.filter((t) => t.client.name === 'Just Burger').length,
    jobs_total: jobs.length,
    jobs_matched_a_ticket: jobs.filter((j) => j.originTicketId).length,
    missing_ticket: rows.filter((r) => r.match_status === 'MISSING_TICKET').length,
    missing_cashflow: rows.filter((r) => r.match_status === 'MISSING_CASHFLOW').length,
    missing_ot: rows.filter((r) => r.missing_ot === 'SI').length,
    missing_it: rows.filter((r) => r.missing_it === 'SI').length,
    requires_manual_action: rows.filter((r) => r.requires_manual_action === 'SI').length,
    por_cliente: Object.fromEntries(
      [...new Set(jobs.map((j) => j.client.name))].map((name) => [
        name,
        {
          jobs: jobs.filter((j) => j.client.name === name).length,
          jobs_con_ticket: jobs.filter((j) => j.client.name === name && j.originTicketId).length,
        },
      ]),
    ),
  }
  writeFileSync('backups/reconciliation-summary.json', JSON.stringify(summary, null, 2))

  console.log(JSON.stringify(summary, null, 2))
  console.log('\nReportes: backups/reconciliation-report.csv, backups/reconciliation-summary.json')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
