/**
 * Importa el histórico de tickets de Just Burger desde el Excel del GAS.
 * Idempotente: upsert por ticketCode. No modifica tickets ya existentes.
 * Run (dev):  npx tsx scripts/import-jb-tickets.ts
 * Run (prod): npm run import:jb:prod
 */
import ExcelJS from 'exceljs'
import { prisma } from '../src/lib/prisma.js'

const FILE = 'justburger-ingegar/Fuente_Datos_Trabajos_JustBurger.xlsx'
const TENANT_SLUG = 'ingegar'
const CLIENT_NAME = 'Just Burger'

// ── helpers ───────────────────────────────────────────────────────────────────
const cell = (row: ExcelJS.Row, i: number): unknown => {
  const v = (row.values as unknown[])[i]
  if (v == null) return null
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: unknown }
    return o.result ?? o.text ?? null
  }
  return v
}
const str = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
const asDate = (v: unknown): Date | null => v instanceof Date ? v : null

function normalizeStatus(raw: unknown): string {
  const s = str(raw)?.toLowerCase() ?? ''
  if (s.includes('nuevo')) return 'nuevo'
  if (s.includes('revisión') || s.includes('revision') || s.includes('revisado')) return 'en_revision'
  if (s.includes('ejecución') || s.includes('ejecucion') || s.includes('proceso')) return 'en_ejecucion'
  if (s.includes('esperando') || s.includes('aprobación')) return 'esperando_aprobacion'
  if (s.includes('resuelto') || s.includes('completado') || s.includes('cerrado')) return 'resuelto'
  if (s.includes('cancelado') || s.includes('anulado')) return 'cancelado'
  if (s.includes('fusionado') || s.includes('merged')) return 'fusionado'
  return 'resuelto'
}

function normalizeUrgency(raw: unknown): string {
  const s = str(raw)?.toLowerCase() ?? ''
  if (s.includes('emergencia')) return 'emergencia'
  if (s.includes('urgencia') || s.includes('urgente')) return 'urgencia'
  if (s.includes('preventivo')) return 'preventivo'
  return 'no_urgente'
}

// ── main ──────────────────────────────────────────────────────────────────────
const tenantResult = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
if (!tenantResult) throw new Error('Tenant ingegar no encontrado')
const tenant = tenantResult

// Admin user para asignar como creador de tickets históricos
const adminUser = await prisma.user.findFirst({
  where: { tenantId: tenant.id, role: 'super' },
})
if (!adminUser) throw new Error('No hay usuario super en el tenant')

// Cliente Just Burger (ya configurado por setup-justburger-portal.ts)
let jbClient = await prisma.client.findFirst({
  where: { tenantId: tenant.id, name: { contains: 'Just Burger' } },
})
if (!jbClient) {
  jbClient = await prisma.client.create({
    data: { tenantId: tenant.id, name: 'Just Burger', portalSlug: 'justburger' },
  })
  console.log('Creado cliente Just Burger')
} else {
  console.log(`Cliente Just Burger: ${jbClient.id}`)
}

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FILE)

// ── 1. Sucursales ─────────────────────────────────────────────────────────────
const wsSuc = wb.getWorksheet('Sucursales')
const branchMap = new Map<string, string>() // name → id

if (wsSuc) {
  for (let r = 2; r <= wsSuc.rowCount; r++) {
    const row = wsSuc.getRow(r)
    const rawName = str(cell(row, 1)) ?? str(cell(row, 3))
    const city = str(cell(row, 4))
    if (!rawName) continue
    const name = rawName.trim()
    const b = await prisma.branch.upsert({
      where: { clientId_name: { clientId: jbClient.id, name } },
      update: { city },
      create: { tenantId: tenant.id, clientId: jbClient.id, name, city },
    })
    branchMap.set(name, b.id)
  }
  console.log(`Sucursales: ${branchMap.size} upserted`)
}

// Helper: devuelve branchId creando si no existe
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
const wsTickets = wb.getWorksheet('Tickets')
if (!wsTickets) throw new Error('No se encontró la hoja "Tickets"')

// Col mapping (1-based, según headers del Excel):
// 1=Ticket_ID, 2=Fecha_Creacion, 3=Sucursal, 4=Urgencia, 5=Estado, 6=Titulo,
// 7=Observacion, 8=Fecha_Compromiso, 9=Fecha_Cierre, 10=Tecnico, 11=OT_Link,
// 12=Carpeta_Drive, 13=Adjuntos, 14=Creado_Por, 15=Ultima_Actualizacion,
// 16=Comentario_Gerenta, 17=Mostrar, 20=Categoria, 21=Descripcion,
// 22=OT_Numero, 23=Comentario_Cliente, 24=Notas_Internas, 25=Fecha_Estimada,
// 26=Resumen_Trabajo

let ticketCount = 0
let skipped = 0
const ticketIdMap = new Map<string, string>() // excelId → dbId

for (let r = 2; r <= wsTickets.rowCount; r++) {
  const row = wsTickets.getRow(r)
  const ticketCode = str(cell(row, 1))
  if (!ticketCode) continue

  const rawBranch = str(cell(row, 3)) ?? 'Sin sucursal'
  const branchId = await getBranchId(rawBranch)

  const driveRaw = cell(row, 12)
  let driveFolderUrl: string | null = null
  if (driveRaw && typeof driveRaw === 'object') {
    const d = driveRaw as { text?: string; hyperlink?: string }
    driveFolderUrl = d.hyperlink ?? d.text ?? null
  } else {
    driveFolderUrl = str(driveRaw)
  }

  const showToClient = String(cell(row, 17) ?? 'Si').trim().toLowerCase() !== 'no'
  const createdAt = asDate(cell(row, 2)) ?? new Date()
  const closedDate = asDate(cell(row, 9))
  const estimatedDate = asDate(cell(row, 25))
  const status = normalizeStatus(cell(row, 5))

  const data = {
    title: str(cell(row, 6)) ?? '(sin título)',
    description: str(cell(row, 7)) ?? str(cell(row, 21)),
    urgency: normalizeUrgency(cell(row, 4)),
    category: str(cell(row, 20)),
    status,
    otNumber: str(cell(row, 22)),
    estimatedDate,
    closedDate,
    workSummary: str(cell(row, 26)),
    clientComment: str(cell(row, 23)),
    internalNotes: str(cell(row, 24)),
    driveFolderUrl,
    showToClient,
    tenantId: tenant.id,
    clientId: jbClient!.id,
    branchId,
    createdById: adminUser!.id,
    updatedAt: asDate(cell(row, 15)) ?? createdAt,
  }

  const existing = await prisma.ticket.findUnique({ where: { ticketCode } })
  let ticketDbId: string

  if (existing) {
    ticketDbId = existing.id
    skipped++
  } else {
    const t = await prisma.ticket.create({
      data: { ...data, ticketCode, createdAt, urgency: data.urgency as never, status: data.status as never },
    })
    ticketDbId = t.id
    ticketCount++
  }

  ticketIdMap.set(ticketCode, ticketDbId)
}

console.log(`Tickets: ${ticketCount} importados, ${skipped} ya existían`)

// ── 3. Historial ──────────────────────────────────────────────────────────────
const wsHist = wb.getWorksheet('Historial')
let histCount = 0

if (wsHist) {
  // Col: 1=Ticket_ID, 2=Fecha, 3=Estado_Anterior, 4=Estado_Nuevo, 5=Usuario, 6=Nota
  for (let r = 2; r <= wsHist.rowCount; r++) {
    const row = wsHist.getRow(r)
    const ticketCode = str(cell(row, 1))
    if (!ticketCode) continue
    const ticketDbId = ticketIdMap.get(ticketCode)
    if (!ticketDbId) continue // ticket no importado (ya existía)

    const histDate = asDate(cell(row, 2)) ?? new Date()
    const note = str(cell(row, 6))
    const fromStatus = str(cell(row, 3))
    const toStatus = str(cell(row, 4))
    const isInternal = false // historial del GAS es siempre público

    // Solo crear si no hay historial para este ticket
    const existingHist = await prisma.ticketHistory.count({ where: { ticketId: ticketDbId } })
    if (existingHist > 0) continue

    await prisma.ticketHistory.create({
      data: {
        ticketId: ticketDbId,
        fromStatus,
        toStatus,
        note,
        isInternal,
        createdAt: histDate,
      },
    })
    histCount++
  }
  console.log(`Historial: ${histCount} entradas importadas`)
}

console.log('\n🎉 Import JB completo.')
console.log(`  ${ticketCount} tickets nuevos`)
console.log(`  ${branchMap.size} sucursales`)
console.log(`  ${histCount} entradas de historial`)

await prisma.$disconnect()
