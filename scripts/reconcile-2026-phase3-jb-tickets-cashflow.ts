/**
 * Reconciliación 2026 — Fase 3: vincular tickets de Just Burger con sus
 * trabajos de Flujo de Caja (Job.originTicketId — el mecanismo real que ya
 * usa la app hoy, confirmado en src/app/(app)/tickets/[id]/page.tsx).
 *
 * Señales disponibles de verdad (Ticket NO tiene monto/costCenter/OT-número
 * comparables directos con Job — se corrobora con sucursal + fecha, no con
 * los campos financieros que solo existen en Job):
 *   - sucursal (normalizada, cruzando familias "Tienda X" vs "X")
 *   - fecha (Ticket.closedDate/estimatedDate vs Job.executionDate)
 *   - descripción (señal débil de apoyo, no decide sola)
 *
 * HIGH confidence = sucursal Y fecha coinciden exacto, y es 1:1 (ni el
 * ticket ni el job ya están vinculados a otra cosa). Cualquier otro caso
 * queda para revisión, no se adivina.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase3-jb-tickets-cashflow.ts
 *      npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase3-jb-tickets-cashflow.ts --apply
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'
import { normalizeBranchName } from '../src/lib/cashflow/normalize.js'

const APPLY = process.argv.includes('--apply')

function stripTienda(name: string | null | undefined): string | null {
  if (!name) return null
  return normalizeBranchName(name.replace(/^tienda\s+/i, ''))
}

// Muchos Job (sobre todo del import histórico original, antes de esta
// sesión) tienen executionDate=null aunque su propio `code` YA trae la
// fecha embebida (YYMMDD-CLI-TT-NN) — se usa como respaldo en vez de dejar
// esos jobs fuera del matching solo porque una columna quedó vacía.
function jobEffectiveDate(executionDate: Date | null, code: string | null): string | null {
  if (executionDate) return new Date(executionDate).toISOString().slice(0, 10)
  const m = code?.match(/^(\d{2})(\d{2})(\d{2})-/)
  if (!m) return null
  return `20${m[1]}-${m[2]}-${m[3]}`
}

async function main() {
  console.log(APPLY ? '=== FASE 3 — MODO APPLY ===' : '=== FASE 3 — MODO DRY-RUN ===')

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'ingegar' } })
  if (!tenant) throw new Error('Tenant "ingegar" no existe')
  const client = await prisma.client.findFirst({ where: { tenantId: tenant.id, name: 'Just Burger' } })
  if (!client) throw new Error('Cliente "Just Burger" no existe')

  const tickets = await prisma.ticket.findMany({
    where: { clientId: client.id, deletedAt: null },
    select: { id: true, ticketCode: true, title: true, closedDate: true, estimatedDate: true, branch: { select: { name: true } }, originJobs: { select: { id: true } } },
  })
  const jobs = await prisma.job.findMany({
    where: { clientId: client.id },
    select: { id: true, code: true, description: true, executionDate: true, originTicketId: true, branch: { select: { name: true } } },
  })

  console.log(`Tickets Just Burger: ${tickets.length} | Jobs Just Burger: ${jobs.length}`)

  const unlinkedTickets = tickets.filter((t) => t.originJobs.length === 0)
  const unlinkedJobs = jobs.filter((j) => !j.originTicketId)
  console.log(`Tickets sin Job vinculado: ${unlinkedTickets.length} | Jobs sin Ticket de origen: ${unlinkedJobs.length}`)

  type Report = { ticket_code: string; job_code: string; match_status: string; confidence: string; action: string }
  const report: Report[] = []
  let linked = 0, ambiguous = 0, noCandidate = 0

  for (const t of unlinkedTickets) {
    const tBranch = stripTienda(t.branch?.name)
    // Fecha_Cierre y Fecha_Compromiso suelen diferir varios días (cierre
    // administrativo vs visita agendada) — cualquiera de las dos puede ser
    // la fecha real de ejecución, así que se prueban ambas, no solo una.
    const tDateStrs = new Set([t.closedDate, t.estimatedDate].filter((d): d is Date => !!d).map((d) => new Date(d).toISOString().slice(0, 10)))
    if (!tBranch || tDateStrs.size === 0) { noCandidate++; continue }

    const candidates = unlinkedJobs.filter((j) => {
      const jBranch = stripTienda(j.branch?.name)
      if (jBranch !== tBranch) return false
      const jDate = jobEffectiveDate(j.executionDate, j.code)
      return jDate != null && tDateStrs.has(jDate)
    })

    if (candidates.length === 1) {
      linked++
      const job = candidates[0]
      report.push({ ticket_code: t.ticketCode, job_code: job.code ?? job.id, match_status: 'MATCHED', confidence: 'HIGH', action: APPLY ? 'link' : 'would-link' })
      if (APPLY) {
        await prisma.job.update({ where: { id: job.id }, data: { originTicketId: t.id } })
      }
      // saca el job ya usado del pool para que no lo tome otro ticket del mismo día/sucursal
      unlinkedJobs.splice(unlinkedJobs.indexOf(job), 1)
    } else if (candidates.length > 1) {
      ambiguous++
      report.push({ ticket_code: t.ticketCode, job_code: candidates.map((c) => c.code ?? c.id).join('|'), match_status: 'AMBIGUOUS', confidence: 'NONE', action: `${candidates.length} jobs candidatos misma sucursal+fecha` })
    } else {
      noCandidate++
    }
  }

  writeFileSync('backups/reconciliation-phase3-report.csv',
    'ticket_code,job_code,match_status,confidence,action\n' +
    report.map((r) => [r.ticket_code, r.job_code, r.match_status, r.confidence, r.action].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'))

  console.log('\n--- RESUMEN FASE 3 ---')
  console.log(`Vinculados (HIGH): ${linked}`)
  console.log(`Ambiguos (misma sucursal+fecha, más de un job): ${ambiguous}`)
  console.log(`Sin candidato (sin sucursal/fecha o ningún job coincide): ${noCandidate}`)
  console.log('\nReporte: backups/reconciliation-phase3-report.csv')
  if (!APPLY) console.log('\n(dry-run — nada se escribió.)')

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
