/**
 * Reconciliación 2026 — Fase 7: validar OT e Informe Técnico contra datos
 * reales (DB/R2), no contra lo declarado. Solo reporta — no inventa ni
 * genera documentos faltantes.
 *
 * OT = Orden de Trabajo (Ticket.otNumber = folio/texto, Ticket.otFileUrl =
 *      archivo real en R2). OC = Orden de Compra (Job.purchaseOrder) — no
 *      confundir, son cosas distintas.
 * IT = Informe Técnico = ClientDocument{type:'informe', ticketId}. El CSV
 *      trae `it_declarado` (ya guardado como Job.docReport en Fase 2) — se
 *      contrasta contra la existencia real del ClientDocument.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase7-ot-it.ts
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'

function csvEscape(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

async function main() {
  console.log('=== FASE 7 — VALIDACIÓN OT / IT (solo lectura) ===')

  const tickets = await prisma.ticket.findMany({
    where: { deletedAt: null },
    select: { id: true, ticketCode: true, otNumber: true, otFileUrl: true, client: { select: { name: true } } },
  })
  const noOtNumber = tickets.filter((t) => !t.otNumber).length
  const noOtFile = tickets.filter((t) => !t.otFileUrl).length
  const declaredNumberNoFile = tickets.filter((t) => t.otNumber && !t.otFileUrl)
  console.log(`\nTickets totales: ${tickets.length}`)
  console.log(`Sin N° de OT: ${noOtNumber} | Sin archivo de OT en R2: ${noOtFile}`)
  console.log(`Con N° de OT pero SIN archivo real (declarado pero no cargado): ${declaredNumberNoFile.length}`)

  // IT: jobs con docReport=true (it_declarado=SI en el CSV, Fase 2) cuyo
  // ticket de origen no tiene un ClientDocument type=informe real asociado.
  const jobsDeclaredIT = await prisma.job.findMany({
    where: { docReport: true, originTicketId: { not: null } },
    select: { code: true, originTicketId: true, client: { select: { name: true } } },
  })
  const ticketIdsWithReport = new Set(
    (await prisma.clientDocument.findMany({ where: { type: 'informe', ticketId: { not: null } }, select: { ticketId: true } }))
      .map((d) => d.ticketId),
  )
  const declaredButMissing = jobsDeclaredIT.filter((j) => !ticketIdsWithReport.has(j.originTicketId))
  console.log(`\nJob con IT declarado (it_declarado=SI) y ticket vinculado: ${jobsDeclaredIT.length}`)
  console.log(`De esos, SIN Informe Técnico real cargado: ${declaredButMissing.length}`)

  const rows: string[] = ['tipo,ticket_code,job_code,cliente,detalle']
  declaredNumberNoFile.forEach((t) => rows.push(['OT_DECLARADA_NO_CARGADA', t.ticketCode, '', t.client.name, `N° OT "${t.otNumber}" sin archivo real en R2`].map(csvEscape).join(',')))
  for (const j of declaredButMissing) {
    const t = tickets.find((x) => x.id === j.originTicketId)
    rows.push(['IT_DECLARADO_NO_CARGADO', t?.ticketCode ?? '', j.code ?? '', j.client.name, 'it_declarado=SI en el CSV pero no hay ClientDocument tipo informe para este ticket'].map(csvEscape).join(','))
  }
  writeFileSync('backups/reconciliation-phase7-ot-it.csv', rows.join('\n'))
  console.log(`\nReporte: backups/reconciliation-phase7-ot-it.csv (${rows.length - 1} filas)`)

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
