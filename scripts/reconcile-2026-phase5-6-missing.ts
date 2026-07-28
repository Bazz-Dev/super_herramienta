/**
 * Reconciliación 2026 — Fases 5 y 6.
 * Fase 5 (MISSING_CASHFLOW): tickets resueltos sin Job de Flujo asociado —
 * si hay evidencia suficiente (sucursal + alguna fecha), crea un Job mínimo
 * (SIN inventar monto/OC/factura/fechas de pago — quedan null, a la espera
 * de valorización real).
 * Fase 6 (MISSING_TICKET): Job sin Ticket de origen, en TODOS los clientes
 * — solo reporta, nunca crea tickets automáticamente (regla explícita).
 *
 * Run: npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase5-6-missing.ts
 *      npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase5-6-missing.ts --apply
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'
import { normalizeType } from '../src/lib/cashflow/normalize.js'
import { deriveJobStatus, deriveCollectionStatus } from '../src/lib/cashflow/derive-legacy-status.js'
import { generateJobCode, clientCodeFrom, JOB_TYPE_CODE } from '../src/lib/cashflow/generate-code.js'

const APPLY = process.argv.includes('--apply')

function csvEscape(v: unknown): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

async function main() {
  console.log(APPLY ? '=== FASES 5-6 — MODO APPLY ===' : '=== FASES 5-6 — MODO DRY-RUN ===')
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'ingegar' } })
  if (!tenant) throw new Error('Tenant "ingegar" no existe')

  // --- FASE 5: MISSING_CASHFLOW (solo Just Burger tiene tickets hoy) ---
  const jbClient = await prisma.client.findFirst({ where: { tenantId: tenant.id, name: 'Just Burger' } })
  const resolvedNoJob = await prisma.ticket.findMany({
    where: { clientId: jbClient!.id, status: 'resuelto', deletedAt: null, originJobs: { none: {} } },
    select: { id: true, ticketCode: true, title: true, description: true, closedDate: true, estimatedDate: true, createdAt: true, branchId: true, branch: { select: { name: true } } },
  })
  console.log(`\nFase 5 — tickets JB resueltos sin Job: ${resolvedNoJob.length}`)

  const seqCache = new Map<string, number>()
  let phase5Created = 0, phase5Skipped = 0
  const phase5Rows: string[] = ['ticket_code,action,job_code']
  for (const t of resolvedNoJob) {
    if (!t.branchId) { phase5Skipped++; phase5Rows.push([t.ticketCode, 'skip-sin-sucursal', ''].map(csvEscape).join(',')); continue }
    const execDateRaw = t.closedDate ?? t.estimatedDate
    const execDate = execDateRaw ? new Date(execDateRaw).toISOString().slice(0, 10) : null
    const type = normalizeType('') // sin tipo de trabajo declarado en Ticket — default "otro" vía normalizeType('')
    const code = await generateJobCode(clientCodeFrom(jbClient!.name), JOB_TYPE_CODE[type] ?? 'OT', execDate, seqCache)
    phase5Created++
    phase5Rows.push([t.ticketCode, APPLY ? 'create' : 'would-create', code].map(csvEscape).join(','))
    if (APPLY) {
      const job = await prisma.job.create({
        data: {
          tenantId: tenant.id, clientId: jbClient!.id, branchId: t.branchId,
          description: t.description || t.title,
          type, code,
          executionDate: execDateRaw ? new Date(execDateRaw) : null,
          originTicketId: t.id,
          operationalStage: 'executed', financialStage: 'no_po',
          status: deriveJobStatus('executed', false),
          collectionStatus: deriveCollectionStatus('no_po'),
        },
      })
      void job
    }
  }
  writeFileSync('backups/reconciliation-phase5-report.csv', phase5Rows.join('\n'))
  console.log(`Fase 5 — creados: ${phase5Created} | sin sucursal (omitidos): ${phase5Skipped}`)

  // --- FASE 6: MISSING_TICKET (todos los clientes, solo reporte) ---
  const jobsNoTicket = await prisma.job.findMany({
    where: { originTicketId: null },
    select: {
      code: true, importRef: true, description: true, type: true, status: true, financialStage: true,
      costCenter: true, jobNumber: true, quoteRef: true, executionDate: true, netAmount: true,
      purchaseOrder: true, invoiceNumber: true,
      client: { select: { name: true } }, branch: { select: { name: true } },
    },
  })
  console.log(`\nFase 6 — Job sin Ticket (todos los clientes): ${jobsNoTicket.length}`)

  const header = 'cliente,sucursal,centro_costo,numero_trabajo,presupuesto,fecha_ejecucion,descripcion,tipo_trabajo,monto,oc,factura,estado_trabajo,estado_financiero,source_ref'
  const phase6Rows = jobsNoTicket.map((j) => [
    j.client.name, j.branch?.name ?? '', j.costCenter ?? '', j.jobNumber ?? '', j.quoteRef ?? '',
    j.executionDate ? new Date(j.executionDate).toISOString().slice(0, 10) : '', j.description,
    j.type, j.netAmount ?? '', j.purchaseOrder ?? '', j.invoiceNumber ?? '', j.status, j.financialStage,
    j.importRef ?? '',
  ].map(csvEscape).join(','))
  writeFileSync('backups/reconciliation-phase6-missing-ticket.csv', [header, ...phase6Rows].join('\n'))

  const byClient: Record<string, number> = {}
  jobsNoTicket.forEach((j) => { byClient[j.client.name] = (byClient[j.client.name] ?? 0) + 1 })
  console.log('Por cliente:', JSON.stringify(byClient))

  console.log('\nReportes: backups/reconciliation-phase5-report.csv, backups/reconciliation-phase6-missing-ticket.csv')
  if (!APPLY) console.log('\n(dry-run — nada se escribió.)')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
