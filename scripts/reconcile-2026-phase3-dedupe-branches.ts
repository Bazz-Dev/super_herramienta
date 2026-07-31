/**
 * Reconciliación 2026 — Fase 3: fusiona sucursales duplicadas de Just Burger.
 *
 * Causa raíz: el import histórico de Flujo de Caja (Fase 2,
 * reconcile-2026-phase2-cashflow.ts) crea/usa sucursales con el nombre corto
 * tal como viene en la columna "sucursal" del CSV (ej. "Isidora"), vía
 * branch.upsert() por nombre exacto — normalizeBranchName() solo hace
 * title-case, no homologa contra el nombre operativo real. El flujo de
 * tickets/portal en vivo, en cambio, siempre usó el nombre completo con
 * prefijo "Tienda " (ej. "Tienda Isidora") — creado por separado, nunca
 * matcheado contra el de la importación. Resultado: 13 pares duplicados
 * (confirmados 1:1 por conteo real — ver scripts/_check-dupe-branches.ts),
 * cada uno con la sucursal corta acumulando trabajos de Flujo de Caja pero
 * CERO tickets/usuarios de portal, y la "Tienda X" con los tickets/usuarios
 * reales. "Lo Barnechea" no tiene par "Tienda X" — no es un duplicado, no se
 * toca.
 *
 * Qué hace este script (por cada par loser->winner):
 *   1. Reasigna Job.branchId, Ticket.branchId y User.branchId del loser al
 *      winner (tickets/users hoy están en 0 para el loser, pero se hace de
 *      forma genérica/defensiva por si hay drift entre el diagnóstico y esta
 *      corrida).
 *   2. Desactiva el loser (active=false) — NUNCA se borra, ver
 *      .claude/rules/production-safety.md ("mover/anotar el duplicado, no
 *      eliminarlo"). Job.branchId es NOT NULL + onDelete:Restrict, así que
 *      un delete real habría fallado igual.
 *
 * Riesgo de recurrencia (fuera de alcance de este fix, dejado como nota para
 * el dueño): si Fase 2 vuelve a correr con nuevas filas CSV para estas
 * sucursales, branch.upsert() por nombre exacto encontrará la sucursal corta
 * ya desactivada y le seguirá atando trabajos nuevos — desactivar no impide
 * que se reuse. Arreglar esto de raíz requeriría que getBranchId() en Fase 2
 * matchee contra el nombre "Tienda X" equivalente, no solo el nombre exacto.
 *
 * Run (dry-run, no escribe nada):
 *   npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase3-dedupe-branches.ts
 * Run (aplica):
 *   npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase3-dedupe-branches.ts --apply
 *
 * ANTES de --apply contra producción: correr
 *   npx tsx --env-file=.env.production.local scripts/backup-turso-tables.ts
 */
import { prisma } from '../src/lib/prisma.js'

const APPLY = process.argv.includes('--apply')

// loser (nombre corto, del import histórico) -> winner (nombre operativo
// real, con usuarios de portal y tickets reales).
const PAIRS: Array<{ loser: string; winner: string }> = [
  { loser: 'Toesca', winner: 'Tienda Toesca' },
  { loser: 'Manuel Montt', winner: 'Tienda Manuel Montt' },
  { loser: 'Huechuraba', winner: 'Tienda Huechuraba' },
  { loser: 'Providencia', winner: 'Tienda Providencia' },
  { loser: 'La Florida', winner: 'Tienda La Florida' },
  { loser: 'Rotonda Atenas', winner: 'Tienda Rotonda Atenas' },
  { loser: 'MachalÍ', winner: 'Tienda Machalí' },
  { loser: 'La Reina', winner: 'Tienda La Reina' },
  { loser: 'Isidora', winner: 'Tienda Isidora' },
  { loser: 'Villa Alemana', winner: 'Tienda Villa Alemana' },
  { loser: 'Viña del Mar', winner: 'Tienda Viña del Mar' },
  { loser: 'Tranqueras', winner: 'Tienda Tranqueras' },
  { loser: 'Quilín', winner: 'Tienda Mall Paseo Quilín' },
]

async function main() {
  console.log(APPLY ? '=== FASE 3 — MODO APPLY ===' : '=== FASE 3 — MODO DRY-RUN (nada se escribe) ===')

  const client = await prisma.client.findFirst({ where: { name: 'Just Burger' } })
  if (!client) throw new Error('Cliente "Just Burger" no encontrado')

  let merged = 0, skipped = 0
  for (const { loser, winner } of PAIRS) {
    const [loserBranch, winnerBranch] = await Promise.all([
      prisma.branch.findFirst({ where: { clientId: client.id, name: loser } }),
      prisma.branch.findFirst({ where: { clientId: client.id, name: winner } }),
    ])
    if (!loserBranch || !winnerBranch) {
      console.log(`⚠ SKIP "${loser}" -> "${winner}": no encontrada(s) (loser=${!!loserBranch} winner=${!!winnerBranch})`)
      skipped++
      continue
    }
    if (!loserBranch.active) {
      console.log(`- "${loser}" ya está inactiva, se omite (probable corrida anterior).`)
      continue
    }

    const [jobCount, ticketCount, userCount] = await Promise.all([
      prisma.job.count({ where: { branchId: loserBranch.id } }),
      prisma.ticket.count({ where: { branchId: loserBranch.id } }),
      prisma.user.count({ where: { branchId: loserBranch.id } }),
    ])
    console.log(
      `"${loser}" (${loserBranch.id}) -> "${winner}" (${winnerBranch.id}): ` +
      `jobs=${jobCount} tickets=${ticketCount} portalUsers=${userCount}`,
    )
    merged++

    if (APPLY) {
      await prisma.$transaction([
        prisma.job.updateMany({ where: { branchId: loserBranch.id }, data: { branchId: winnerBranch.id } }),
        prisma.ticket.updateMany({ where: { branchId: loserBranch.id }, data: { branchId: winnerBranch.id } }),
        prisma.user.updateMany({ where: { branchId: loserBranch.id }, data: { branchId: winnerBranch.id } }),
        prisma.branch.update({ where: { id: loserBranch.id }, data: { active: false } }),
      ])
    }
  }

  console.log(`\n${merged} pares fusionados${skipped ? `, ${skipped} omitidos` : ''}.`)
  console.log(APPLY ? 'Aplicado.' : '\n(dry-run — corré con --apply para escribir.)')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
