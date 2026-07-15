/**
 * Importa / actualiza el histórico de tickets de Just Burger desde Excel.
 * Idempotente — puede correrse múltiples veces sin duplicar datos.
 * Novedades:
 *   - Importa hoja Tecnicos → upsert en DB + enlace a usuarios existentes
 *   - Asigna assignedToId por nombre de técnico (col 10)
 *   - ACTUALIZA tickets ya existentes (assignedToId + fechas)
 *   - Historia idempotente por (ticketId, minuto-bucket, nota)
 *   - Normaliza fromStatus/toStatus a enum lowercase
 *
 * Run (prod):  npm run import:jb:prod
 * Run (local): npx tsx --env-file=.env scripts/import-jb-tickets.ts
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
  // Date objects must be checked before the generic object branch — typeof Date === 'object'
  // so without this guard they'd be converted to null via o.result ?? o.text ?? null.
  if (v instanceof Date) return v
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

/** Strip accents + lowercase for fuzzy name matching */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

type TicketStatus = Prisma.TicketCreateInput['status']
type TicketUrgency = Prisma.TicketCreateInput['urgency']

function normalizeStatus(raw: unknown): TicketStatus {
  const s = norm(str(raw) ?? '')
  if (s.includes('nuevo'))                              return 'nuevo'
  if (s.includes('revision') || s.includes('revisad')) return 'en_revision'
  if (s.includes('ejecucion') || s.includes('proceso')) return 'en_ejecucion'
  if (s.includes('esperando') || s.includes('aprobac')) return 'esperando_aprobacion'
  if (s.includes('cancelado') || s.includes('anulado')) return 'cancelado'
  if (s.includes('fusionado') || s.includes('merged'))  return 'fusionado'
  return 'resuelto'
}
function normalizeHistStatus(raw: unknown): string | null {
  const s = str(raw)
  if (!s) return null
  return normalizeStatus(s) as string
}
function normalizeUrgency(raw: unknown): TicketUrgency {
  const s = norm(str(raw) ?? '')
  if (s.includes('emergencia'))                         return 'emergencia'
  if (s.includes('urgencia') || s.includes('urgente')) return 'urgencia'
  if (s.includes('preventivo'))                         return 'preventivo'
  return 'no_urgente'
}

// ── bootstrap ─────────────────────────────────────────────────────────────────

const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'ingegar' } })
const adminUser = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, role: 'super' } })

// Fallback assignee for tickets whose tech doesn't have a user account in INGEGAR
const jesusDiaz = await prisma.user.findFirst({
  where: { tenantId: tenant.id, name: { contains: 'Jesus' } },
  select: { id: true, name: true },
})
if (jesusDiaz) console.log(`  ↳ Fallback técnico: ${jesusDiaz.name}`)
else console.log(`  ⚠ No se encontró usuario "Jesus Diaz" — tickets sin técnico quedará sin asignar`)

let jbClient = await prisma.client.findFirst({
  where: { tenantId: tenant.id, portalSlug: CLIENT_SLUG },
})
if (!jbClient) {
  jbClient = await prisma.client.create({
    data: { tenantId: tenant.id, name: 'Just Burger', portalSlug: CLIENT_SLUG, label: 'principal' },
  })
}
console.log(`\n✓ Cliente: ${jbClient.name} (${jbClient.id})`)

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
      update: { city: city ?? undefined },
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

// ── 2. Técnicos ───────────────────────────────────────────────────────────────
// Hoja: col 1=Nombre, 2=Especialidad, 3=Activo
// Upsert cada técnico; si hay usuario con nombre coincidente y sin technicianId, lo enlaza.

const wsTechs = wb.getWorksheet('Tecnicos')
const techNameToId = new Map<string, string>() // norm(name) → technicianId

// Pre-load all users for matching
const allUsers = await prisma.user.findMany({
  where: { tenantId: tenant.id },
  select: { id: true, name: true, technicianId: true },
})
const userNormMap = new Map<string, { id: string; technicianId: string | null }>()
for (const u of allUsers) {
  if (u.name) userNormMap.set(norm(u.name), { id: u.id, technicianId: u.technicianId })
}

function findUserByNormName(normName: string): string | null {
  if (userNormMap.has(normName)) return userNormMap.get(normName)!.id
  for (const [uNorm, u] of userNormMap) {
    if (normName.includes(uNorm) || uNorm.includes(normName)) return u.id
  }
  const words = normName.split(/\s+/)
  for (const [uNorm, u] of userNormMap) {
    const uWords = uNorm.split(/\s+/)
    const overlap = words.filter(w => w.length > 3 && uWords.includes(w))
    if (overlap.length >= 2) return u.id
  }
  return null
}

if (wsTechs) {
  for (let r = 2; r <= wsTechs.rowCount; r++) {
    const row = wsTechs.getRow(r)
    const name = str(cell(row, 1))
    if (!name) continue
    const specialty = str(cell(row, 2))
    const active = !(str(cell(row, 3)) ?? 'Sí').toLowerCase().includes('no')

    // Upsert by findFirst + create (no unique compound index on name+tenantId in Prisma)
    let tech = await prisma.technician.findFirst({ where: { tenantId: tenant.id, name } })
    if (tech) {
      tech = await prisma.technician.update({ where: { id: tech.id }, data: { specialty: specialty ?? undefined, active } })
    } else {
      tech = await prisma.technician.create({ data: { tenantId: tenant.id, name, specialty, active } })
    }
    techNameToId.set(norm(name), tech.id)

    // Link to matching user if not already linked
    const matchedUserId = findUserByNormName(norm(name))
    if (matchedUserId) {
      const matchedUser = userNormMap.get([...userNormMap.keys()].find(k => userNormMap.get(k)?.id === matchedUserId) ?? '')
      if (matchedUser && !matchedUser.technicianId) {
        await prisma.user.update({ where: { id: matchedUserId }, data: { technicianId: tech.id } })
        console.log(`  ↔ Enlazado ${name} → user ${matchedUserId}`)
      }
    }
  }
}
console.log(`✓ Técnicos: ${techNameToId.size}`)

async function findUserId(techName: string | null): Promise<string | null> {
  if (!techName) return null
  const found = findUserByNormName(norm(techName))
  // Tech named but no user account → fallback to Jesus Diaz
  return found ?? jesusDiaz?.id ?? null
}

// ── 3. Tickets ────────────────────────────────────────────────────────────────
// Col: 1=Ticket_ID 2=Fecha_Creacion 3=Sucursal 4=Urgencia 5=Estado 6=Titulo
//      7=Observacion 8=Fecha_Compromiso 9=Fecha_Cierre 10=Tecnico
//      14=Creado_Por 15=Ultima_Actualizacion 17=Mostrar 20=Categoria
//      21=Descripcion 22=OT_Numero 23=Comentario_Cliente 24=Notas_Internas
//      25=Fecha_Estimada 26=Resumen_Trabajo  (col 12=Carpeta_Drive ignorada — migrado a R2)

const wsTickets = wb.getWorksheet('Tickets')
if (!wsTickets) throw new Error('Hoja "Tickets" no encontrada en el Excel')

let created = 0, ticketUpdated = 0, unchanged = 0
const ticketIdMap = new Map<string, string>() // ticketCode → ticket.id

for (let r = 2; r <= wsTickets.rowCount; r++) {
  const row = wsTickets.getRow(r)
  const ticketCode = str(cell(row, 1))
  if (!ticketCode) continue

  const techName     = str(cell(row, 10))
  const assignedToId = await findUserId(techName)

  const existing = await prisma.ticket.findUnique({
    where: { ticketCode },
    select: { id: true, assignedToId: true, internalNotes: true, createdAt: true, closedDate: true },
  })

  if (existing) {
    ticketIdMap.set(ticketCode, existing.id)

    const needsAssignee = assignedToId && existing.assignedToId !== assignedToId

    // Patch dates if the stored value was set to today (import bug) instead of the Excel date
    const excelCreatedAt  = asDate(cell(row, 2))
    const excelClosedDate = asDate(cell(row, 9))
    const storedMs = existing.createdAt.getTime()
    const importBugThreshold = Date.now() - 2 * 86_400_000
    const needsDatePatch = excelCreatedAt && storedMs > importBugThreshold

    if (needsAssignee || needsDatePatch) {
      await prisma.ticket.update({
        where: { id: existing.id },
        data: {
          ...(needsAssignee ? { assignedToId } : {}),
          ...(needsDatePatch ? {
            createdAt: excelCreatedAt,
            updatedAt: asDate(cell(row, 15)) ?? excelCreatedAt,
            ...(excelClosedDate && !existing.closedDate ? { closedDate: excelClosedDate } : {}),
          } : {}),
        },
      })
      ticketUpdated++
    } else {
      unchanged++
    }
    continue
  }

  // New ticket
  const branchId   = await getBranchId(str(cell(row, 3)) ?? 'Sin sucursal')
  const createdAt  = asDate(cell(row, 2)) ?? new Date()
  const driveNote  = str(cell(row, 24)) // internalNotes — Drive URL omitted intentionally (migrado a R2)

  const data: Prisma.TicketUncheckedCreateInput = {
    ticketCode,
    tenantId:      tenant.id,
    clientId:      jbClient.id,
    branchId,
    createdById:   adminUser.id,
    assignedToId:  assignedToId ?? undefined,
    title:         str(cell(row, 6)) ?? '(sin título)',
    description:   str(cell(row, 7)) ?? str(cell(row, 21)),
    urgency:       normalizeUrgency(cell(row, 4)),
    status:        normalizeStatus(cell(row, 5)),
    category:      str(cell(row, 20)),
    otNumber:      str(cell(row, 22)),
    workSummary:   str(cell(row, 26)),
    clientComment: str(cell(row, 23)),
    internalNotes: driveNote ?? undefined,
    estimatedDate: asDate(cell(row, 25)),
    closedDate:    asDate(cell(row, 9)),
    showToClient:  String(cell(row, 17) ?? 'Si').trim().toLowerCase() !== 'no',
    folderKey:     ticketFolderKey(CLIENT_SLUG, ticketCode),
    createdAt,
    updatedAt:     asDate(cell(row, 15)) ?? createdAt,
  }

  const t = await prisma.ticket.create({ data })
  ticketIdMap.set(ticketCode, t.id)
  created++

  if ((created + ticketUpdated) % 50 === 0) {
    process.stdout.write(`  ${created + ticketUpdated} procesados...\n`)
  }
}

console.log(`\n✓ Tickets: ${created} creados | ${ticketUpdated} actualizados | ${unchanged} sin cambios`)

const totalTickets   = await prisma.ticket.count({ where: { clientId: jbClient.id } })
const assignedTickets = await prisma.ticket.count({ where: { clientId: jbClient.id, assignedToId: { not: null } } })
console.log(`  → Asignados a técnico: ${assignedTickets}/${totalTickets}`)

// ── 4. Historial ──────────────────────────────────────────────────────────────
// Col: 1=Ticket_ID 2=Fecha 3=Estado_Anterior 4=Estado_Nuevo 5=Usuario 6=Nota
// Dedup por (ticketId, minuto-bucket, nota) — nunca duplica entradas.

const wsHist = wb.getWorksheet('Historial')
let histCreated = 0, histSkipped = 0

if (wsHist) {
  // Pre-load existing history per ticket to avoid N queries per row
  const existingKeys = new Map<string, Set<string>>() // ticketId → Set<bucket:note>

  for (const [, tid] of ticketIdMap) {
    if (existingKeys.has(tid)) continue
    const rows = await prisma.ticketHistory.findMany({
      where: { ticketId: tid },
      select: { createdAt: true, note: true },
    })
    existingKeys.set(tid, new Set(
      rows.map(h => `${Math.floor(h.createdAt.getTime() / 60000)}:${(h.note ?? '').slice(0, 100)}`)
    ))
  }

  for (let r = 2; r <= wsHist.rowCount; r++) {
    const row = wsHist.getRow(r)
    const code = str(cell(row, 1))
    if (!code) continue
    const ticketId = ticketIdMap.get(code)
    if (!ticketId) continue

    const createdAt = asDate(cell(row, 2)) ?? new Date()
    const note      = str(cell(row, 6))
    const key       = `${Math.floor(createdAt.getTime() / 60000)}:${(note ?? '').slice(0, 100)}`
    const keySet    = existingKeys.get(ticketId)!

    if (keySet.has(key)) {
      histSkipped++
      continue
    }

    await prisma.ticketHistory.create({
      data: {
        ticketId,
        fromStatus: normalizeHistStatus(cell(row, 3)),
        toStatus:   normalizeHistStatus(cell(row, 4)),
        note,
        isInternal: false,
        createdAt,
      },
    })
    keySet.add(key)
    histCreated++
  }
}

console.log(`✓ Historial: ${histCreated} creadas | ${histSkipped} ya existían`)

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`
🎉 Import completado
   Sucursales : ${branchMap.size}
   Técnicos   : ${techNameToId.size}
   Tickets    : ${created} creados | ${ticketUpdated} actualizados | ${unchanged} sin cambios
   Historial  : ${histCreated} nuevas | ${histSkipped} ya existían
   Asignados  : ${assignedTickets}/${totalTickets} tickets con técnico
`)

await prisma.$disconnect()
