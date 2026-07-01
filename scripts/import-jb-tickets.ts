/**
 * Importa el histórico de tickets de Just Burger desde el Excel del GAS.
 * Idempotente: no modifica tickets ya existentes (upsert por ticketCode).
 * Run (prod): npm run import:jb:prod
 */
import ExcelJS from 'exceljs'
import { prisma } from '../src/lib/prisma.js'
import { ticketFolderKey } from '../src/lib/r2.js'
import type { Prisma } from '../src/generated/prisma/client.js'

const FILE = 'justburger-ingegar/Fuente_Datos_Trabajos_JustBurger.xlsx'
const CLIENT_SLUG = 'justburger'

// ── helpers ───────────────────────────────────────────────────────────────────
function cell(row: ExcelJS.Row, i: number): unknown {
  const v = (row.values as unknown[])[i]
  if (v == null) return null
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: unknown }
    return o.result ?? o.text ?? null
  }
  return v
}
function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
function asDate(v: unknown): Date | null {
  return v instanceof Date ? v : null
}

type TicketStatus = Prisma.TicketCreateInput['status']
type TicketUrgency = Prisma.TicketCreateInput['urgency']

function normalizeStatus(raw: unknown): TicketStatus {
  const s = str(raw)?.toLowerCase() ?? ''
  if (s.includes('nuevo')) return 'nuevo'
  if (s.includes('revisión') || s.includes('revision') || s.includes('revisado')) return 'en_revision'
  if (s.includes('ejecución') || s.includes('ejecucion') || s.includes('proceso')) return 'en_ejecucion'
  if (s.includes('esperando') || s.includes('aprobación')) return 'esperando_aprobacion'
  if (s.includes('cancelado') || s.includes('anulado')) return 'cancelado'
  if (s.includes('fusionado') || s.includes('merged')) return 'fusionado'
  return 'resuelto'
}

function normalizeUrgency(raw: unknown): TicketUrgency {
  const s = str(raw)?.toLowerCase() ?? ''
  if (s.includes('emergencia')) return 'emergencia'
  if (s.includes('urgencia') || s.includes('urgente')) return 'urgencia'
  if (s.includes('preventivo')) return 'preventivo'
  return 'no_urgente'
}

// ── bootstrap: tenant + client + admin ────────────────────────────────────────
const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ingegar' } })
const adminUser = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'super' } })

let jbClient = await prisma.client.findFirst({
  where: { tenantId: tenant.id, portalSlug: CLIENT_SLUG },
})
if (!jbClient) {
  jbClient = await prisma.client.create({
    data: { tenantId: tenant.id, name: 'Just Burger', portalSlug: CLIENT_SLUG },
  })
}
console.log(`✓ Cliente: ${jbClient.name} (${jbClient.id})`)

// ── read excel ────────────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FILE)

// ── 1. Sucursales ─────────────────────────────────────────────────────────────
const wsSuc = wb.getWorksheet('Sucursales')
const branchMap = new Map<string, string>() // name → id

if (wsSuc) {
  for (let r = 2; r <= wsSuc.rowCount; r++) {
    const row = wsSuc.getRow(r)
    const rawName = str(cell(row, 1)) ?? str(cell(row, 3))
    if (!rawName) continue
    const name = rawName.trim()
    const city = str(cell(row, 4))
    const b = await prisma.branch.upsert({
      where: { clientId_name: { clientId: jbClient.id, name } },
      update: { city },
      create: { tenantId: tenant.id, clientId: jbClient.id, name, city },
    })
    branchMap.set(name, b.id)
  }
}
console.log(`✓ Sucursales: ${branchMap.size}`)

async function getBranchId(name: string): Promise<string> {
  if (branchMap.has(name)) return branchMap.get(name)!
  const b = await prisma.branch.upsert({
    where: { clientId_name: { clientId: jbClient!.id, name } },
    update: {},
    create: { tenantId: tenant.id, clientId: jbClient!.id, name },
  })
  branchMap.set(name, b.id)
  return b.id
}

// ── 2. Tickets ────────────────────────────────────────────────────────────────
// Col mapping (1-based):
// 1=Ticket_ID, 2=Fecha_Creacion, 3=Sucursal, 4=Urgencia, 5=Estado, 6=Titulo,
// 7=Observacion, 8=Fecha_Compromiso, 9=Fecha_Cierre, 15=Ultima_Actualizacion,
// 17=Mostrar, 20=Categoria, 21=Descripcion, 22=OT_Numero,
// 23=Comentario_Cliente, 24=Notas_Internas, 25=Fecha_Estimada, 26=Resumen_Trabajo
const wsTickets = wb.getWorksheet('Tickets')
if (!wsTickets) throw new Error('Hoja "Tickets" no encontrada en el Excel')

let imported = 0
let skipped = 0
const ticketIdMap = new Map<string, string>()

for (let r = 2; r <= wsTickets.rowCount; r++) {
  const row = wsTickets.getRow(r)
  const ticketCode = str(cell(row, 1))
  if (!ticketCode) continue

  const existing = await prisma.ticket.findUnique({
    where: { ticketCode },
    select: { id: true },
  })
  if (existing) {
    ticketIdMap.set(ticketCode, existing.id)
    skipped++
    continue
  }

  const branchId = await getBranchId(str(cell(row, 3)) ?? 'Sin sucursal')
  const createdAt = asDate(cell(row, 2)) ?? new Date()

  const data: Prisma.TicketUncheckedCreateInput = {
    ticketCode,
    tenantId: tenant.id,
    clientId: jbClient.id,
    branchId,
    createdById: adminUser.id,
    title: str(cell(row, 6)) ?? '(sin título)',
    description: str(cell(row, 7)) ?? str(cell(row, 21)),
    urgency: normalizeUrgency(cell(row, 4)),
    status: normalizeStatus(cell(row, 5)),
    category: str(cell(row, 20)),
    otNumber: str(cell(row, 22)),
    workSummary: str(cell(row, 26)),
    clientComment: str(cell(row, 23)),
    internalNotes: str(cell(row, 24)),
    estimatedDate: asDate(cell(row, 25)),
    closedDate: asDate(cell(row, 9)),
    showToClient: String(cell(row, 17) ?? 'Si').trim().toLowerCase() !== 'no',
    // R2 folder: documents for this ticket upload to clients/justburger/tickets/{code}/
    folderKey: ticketFolderKey(CLIENT_SLUG, ticketCode),
    createdAt,
    updatedAt: asDate(cell(row, 15)) ?? createdAt,
  }

  const t = await prisma.ticket.create({ data })
  ticketIdMap.set(ticketCode, t.id)
  imported++

  if (imported % 50 === 0) process.stdout.write(`  ${imported} tickets...`)
}

console.log(`\n✓ Tickets: ${imported} importados, ${skipped} ya existían`)

// ── 3. Historial ──────────────────────────────────────────────────────────────
const wsHist = wb.getWorksheet('Historial')
let histCount = 0

if (wsHist) {
  for (let r = 2; r <= wsHist.rowCount; r++) {
    const row = wsHist.getRow(r)
    const ticketCode = str(cell(row, 1))
    if (!ticketCode) continue
    const ticketId = ticketIdMap.get(ticketCode)
    if (!ticketId) continue

    const existing = await prisma.ticketHistory.count({ where: { ticketId } })
    if (existing > 0) continue

    await prisma.ticketHistory.create({
      data: {
        ticketId,
        fromStatus: str(cell(row, 3)),
        toStatus: str(cell(row, 4)),
        note: str(cell(row, 6)),
        isInternal: false,
        createdAt: asDate(cell(row, 2)) ?? new Date(),
      },
    })
    histCount++
  }
}
console.log(`✓ Historial: ${histCount} entradas`)

console.log(`\n🎉 Import completado`)
console.log(`   ${imported} tickets nuevos | ${skipped} ya existían | ${branchMap.size} sucursales | ${histCount} historial`)

await prisma.$disconnect()
