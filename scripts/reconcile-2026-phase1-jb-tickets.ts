/**
 * Reconciliación 2026 — Fase 1: tickets de Just Burger, Excel → Turso.
 * Fuente: justburger-ingegar/just_burger_tickets_latest.xlsx (hoja "Tickets").
 * Match key HIGH-confidence: ticketCode == Ticket_ID (formato idéntico
 * confirmado contra Turso: "20260510-ROTONDAATE-001").
 *
 * Reglas: el Excel manda para datos operacionales, PERO un valor vacío del
 * Excel nunca reemplaza un dato válido ya existente en Turso. Nunca borra.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase1-jb-tickets.ts
 *      npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase1-jb-tickets.ts --apply
 */
import ExcelJS from 'exceljs'
import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'
import type { TicketStatus, TicketUrgency } from '../src/generated/prisma/enums.js'

const XLSX_PATH = 'justburger-ingegar/just_burger_tickets_latest.xlsx'
const APPLY = process.argv.includes('--apply')
const ADMIN_USER_EMAIL = 'admin@ingegarchile.cl'

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}
function norm(s: unknown): string {
  return stripAccents(String(s ?? '').trim().toLowerCase())
}
function str(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}
function excelDate(v: unknown): Date | null {
  if (v instanceof Date) return v
  return null
}

const STATUS_MAP: Record<string, TicketStatus> = {
  'nuevo': 'nuevo',
  'en revision': 'en_revision',
  'en ejecucion': 'en_ejecucion',
  'esperando aprobacion': 'esperando_aprobacion',
  'pendiente aprobacion': 'pendiente_aprobacion',
  'resuelto': 'resuelto',
  'cancelado': 'cancelado',
  'fusionado': 'fusionado',
}
const URGENCY_MAP: Record<string, TicketUrgency> = {
  'emergencia': 'emergencia',
  'urgencia': 'urgencia',
  'no urgente': 'no_urgente',
  'preventivo': 'preventivo',
}

type Row = Record<string, unknown>

type ReportRow = {
  ticket_id: string
  match_status: 'MATCHED' | 'NEW' | 'CONFLICT' | 'AMBIGUOUS'
  confidence: 'HIGH' | 'NONE'
  action: string
  fields_changed: string
  status_before: string
  status_after: string
  conflict_reason: string
}

async function main() {
  console.log(APPLY ? '=== FASE 1 — MODO APPLY ===' : '=== FASE 1 — MODO DRY-RUN ===')

  const tenant = await prisma.tenant.findUnique({ where: { slug: 'ingegar' } })
  if (!tenant) throw new Error('Tenant "ingegar" no existe')
  const client = await prisma.client.findFirst({ where: { tenantId: tenant.id, name: 'Just Burger' } })
  if (!client) throw new Error('Cliente "Just Burger" no existe')
  const adminUser = await prisma.user.findUnique({ where: { email: ADMIN_USER_EMAIL } })
  if (!adminUser) throw new Error(`Usuario admin "${ADMIN_USER_EMAIL}" no existe`)

  const branches = await prisma.branch.findMany({ where: { clientId: client.id } })
  const branchByName = new Map(branches.map((b) => [norm(b.name), b]))

  const technicians = await prisma.technician.findMany({ where: { tenantId: tenant.id } })
  const users = await prisma.user.findMany({ where: { tenantId: tenant.id, role: 'tecnico' }, select: { id: true, technicianId: true } })
  const userByTechId = new Map(users.filter((u) => u.technicianId).map((u) => [u.technicianId as string, u.id]))
  const techIdByName = new Map(technicians.map((t) => [norm(t.name), t.id]))

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(XLSX_PATH)
  const ws = wb.getWorksheet('Tickets')
  if (!ws) throw new Error('Hoja "Tickets" no encontrada en el Excel')
  const headerRow = ws.getRow(1).values as unknown[]
  const idx = (name: string) => (headerRow as string[]).indexOf(name)
  const col = {
    id: idx('Ticket_ID'), fechaCreacion: idx('Fecha_Creacion'), sucursal: idx('Sucursal'),
    urgencia: idx('Urgencia'), estado: idx('Estado'), titulo: idx('Titulo'),
    fechaCompromiso: idx('Fecha_Compromiso'), fechaCierre: idx('Fecha_Cierre'), tecnico: idx('Tecnico'),
    mostrar: idx('Mostrar'), categoria: idx('Categoria'), descripcion: idx('Descripcion'),
    otNumero: idx('OT_Numero'), comentarioCliente: idx('Comentario_Cliente'), notasInternas: idx('Notas_Internas'),
    fechaEstimada: idx('Fecha_Estimada'), resumenTrabajo: idx('Resumen_Trabajo'),
    parentTicketId: idx('Parent_Ticket_ID'), mergedInto: idx('Merged_Into'),
  }

  const rows: Row[] = []
  for (let r = 2; r <= ws.rowCount; r++) {
    const v = ws.getRow(r).values as unknown[]
    if (!v[col.id]) continue
    rows.push({
      ticketId: String(v[col.id]),
      fechaCreacion: excelDate(v[col.fechaCreacion]),
      sucursal: str(v[col.sucursal]),
      urgencia: str(v[col.urgencia]),
      estado: str(v[col.estado]),
      titulo: str(v[col.titulo]),
      fechaCompromiso: excelDate(v[col.fechaCompromiso]),
      fechaCierre: excelDate(v[col.fechaCierre]),
      tecnico: str(v[col.tecnico]),
      mostrar: str(v[col.mostrar]),
      categoria: str(v[col.categoria]),
      descripcion: str(v[col.descripcion]),
      otNumero: str(v[col.otNumero]),
      comentarioCliente: str(v[col.comentarioCliente]),
      notasInternas: str(v[col.notasInternas]),
      fechaEstimada: excelDate(v[col.fechaEstimada]),
      resumenTrabajo: str(v[col.resumenTrabajo]),
      parentCode: str(v[col.mergedInto]) ?? str(v[col.parentTicketId]),
    })
  }
  console.log(`Filas en Excel: ${rows.length}`)

  // Duplicate Ticket_ID within the Excel itself -> AMBIGUOUS, never auto-applied.
  const idCounts = new Map<string, number>()
  rows.forEach((r) => idCounts.set(r.ticketId as string, (idCounts.get(r.ticketId as string) ?? 0) + 1))

  const report: ReportRow[] = []
  let matched = 0, created = 0, ambiguous = 0, conflicts = 0, unresolvedBranch = 0

  for (const row of rows) {
    const ticketId = row.ticketId as string
    if ((idCounts.get(ticketId) ?? 0) > 1) {
      ambiguous++
      report.push({ ticket_id: ticketId, match_status: 'AMBIGUOUS', confidence: 'NONE', action: 'skip', fields_changed: '', status_before: '', status_after: '', conflict_reason: 'Ticket_ID duplicado dentro del propio Excel' })
      continue
    }

    const existing = await prisma.ticket.findUnique({ where: { ticketCode: ticketId } })

    if (existing && existing.clientId !== client.id) {
      conflicts++
      report.push({ ticket_id: ticketId, match_status: 'CONFLICT', confidence: 'NONE', action: 'skip', fields_changed: '', status_before: existing.status, status_after: existing.status, conflict_reason: `ticketCode ya existe pero bajo otro cliente (${existing.clientId})` })
      continue
    }

    const branch = row.sucursal ? branchByName.get(norm(row.sucursal as string)) : undefined
    if (row.sucursal && !branch) unresolvedBranch++

    let assignedToId: string | undefined
    if (row.tecnico) {
      const techId = techIdByName.get(norm(row.tecnico as string))
      if (techId) assignedToId = userByTechId.get(techId)
    }

    const status = row.estado ? STATUS_MAP[norm(row.estado as string)] : undefined
    const urgency = row.urgencia ? URGENCY_MAP[norm(row.urgencia as string)] : undefined
    const showToClient = row.mostrar ? !norm(row.mostrar as string).startsWith('no') : undefined
    let parentTicketId: string | undefined
    if (row.parentCode) {
      const parent = await prisma.ticket.findUnique({ where: { ticketCode: row.parentCode as string }, select: { id: true } })
      if (parent) parentTicketId = parent.id
    }

    if (existing) {
      const changed: string[] = []
      const data: Record<string, unknown> = {}
      const sameValue = (a: unknown, b: unknown) => {
        if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
        return a === b
      }
      const maybeSet = (field: string, excelVal: unknown, currentVal: unknown) => {
        if (excelVal == null) return
        if (sameValue(excelVal, currentVal)) return
        data[field] = excelVal
        changed.push(field)
      }
      maybeSet('status', status, existing.status)
      maybeSet('urgency', urgency, existing.urgency)
      maybeSet('title', row.titulo, existing.title)
      maybeSet('description', row.descripcion, existing.description)
      maybeSet('category', row.categoria, existing.category)
      maybeSet('otNumber', row.otNumero, existing.otNumber)
      maybeSet('estimatedDate', row.fechaCompromiso ?? row.fechaEstimada, existing.estimatedDate)
      maybeSet('closedDate', row.fechaCierre, existing.closedDate)
      maybeSet('workSummary', row.resumenTrabajo, existing.workSummary)
      maybeSet('clientComment', row.comentarioCliente, existing.clientComment)
      maybeSet('internalNotes', row.notasInternas, existing.internalNotes)
      if (showToClient != null) maybeSet('showToClient', showToClient, existing.showToClient)
      if (branch) maybeSet('branchId', branch.id, existing.branchId)
      if (assignedToId) maybeSet('assignedToId', assignedToId, existing.assignedToId)
      if (parentTicketId) maybeSet('parentTicketId', parentTicketId, existing.parentTicketId)

      if (changed.length > 0) {
        matched++
        report.push({ ticket_id: ticketId, match_status: 'MATCHED', confidence: 'HIGH', action: APPLY ? 'update' : 'would-update', fields_changed: changed.join('|'), status_before: existing.status, status_after: (data.status as string) ?? existing.status, conflict_reason: '' })
        if (APPLY) {
          await prisma.ticket.update({ where: { id: existing.id }, data })
          await prisma.ticketHistory.create({ data: { ticketId: existing.id, note: `Reconciliación 2026 — actualizado desde Excel Just Burger (${changed.join(', ')})`, isInternal: true } })
        }
      } else {
        report.push({ ticket_id: ticketId, match_status: 'MATCHED', confidence: 'HIGH', action: 'no-change', fields_changed: '', status_before: existing.status, status_after: existing.status, conflict_reason: '' })
      }
    } else {
      if (!branch || !row.descripcion) {
        ambiguous++
        report.push({ ticket_id: ticketId, match_status: 'AMBIGUOUS', confidence: 'NONE', action: 'skip', fields_changed: '', status_before: '', status_after: '', conflict_reason: !branch ? `Sucursal "${row.sucursal}" no encontrada` : 'Sin descripción' })
        continue
      }
      created++
      report.push({ ticket_id: ticketId, match_status: 'NEW', confidence: 'HIGH', action: APPLY ? 'create' : 'would-create', fields_changed: '', status_before: '', status_after: status ?? 'nuevo', conflict_reason: '' })
      if (APPLY) {
        const newTicket = await prisma.ticket.create({
          data: {
            ticketCode: ticketId,
            title: (row.titulo as string) ?? (row.descripcion as string).slice(0, 80),
            description: row.descripcion as string,
            urgency: urgency ?? 'no_urgente',
            status: status ?? 'nuevo',
            category: row.categoria as string | undefined,
            otNumber: row.otNumero as string | undefined,
            estimatedDate: (row.fechaCompromiso ?? row.fechaEstimada) as Date | undefined,
            closedDate: row.fechaCierre as Date | undefined,
            workSummary: row.resumenTrabajo as string | undefined,
            clientComment: row.comentarioCliente as string | undefined,
            internalNotes: row.notasInternas as string | undefined,
            showToClient: showToClient ?? true,
            tenantId: tenant.id,
            clientId: client.id,
            branchId: branch.id,
            createdById: adminUser.id,
            assignedToId,
            parentTicketId,
            createdAt: (row.fechaCreacion as Date | null) ?? undefined,
          },
        })
        await prisma.ticketHistory.create({ data: { ticketId: newTicket.id, toStatus: newTicket.status, note: 'Reconciliación 2026 — creado desde Excel Just Burger (no existía en Turso)', isInternal: true } })
      }
    }
  }

  writeFileSync('backups/reconciliation-phase1-report.csv',
    'ticket_id,match_status,confidence,action,fields_changed,status_before,status_after,conflict_reason\n' +
    report.map((r) => [r.ticket_id, r.match_status, r.confidence, r.action, r.fields_changed, r.status_before, r.status_after, r.conflict_reason].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'))

  console.log('\n--- RESUMEN FASE 1 ---')
  console.log(`Filas Excel: ${rows.length}`)
  console.log(`Matched (con cambios reales): ${matched}`)
  console.log(`Nuevos (crear): ${created}`)
  console.log(`Ambiguos (sin sucursal/descripción o ID duplicado): ${ambiguous}`)
  console.log(`Conflictos (ticketCode bajo otro cliente): ${conflicts}`)
  console.log(`Filas con sucursal sin resolver: ${unresolvedBranch}`)
  console.log('\nReporte: backups/reconciliation-phase1-report.csv')
  if (!APPLY) console.log('\n(dry-run — nada se escribió. Correr con --apply para aplicar.)')

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
