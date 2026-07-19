/**
 * Read-only: cruza el técnico del Excel fuente (columna 10 de la hoja
 * Tickets) contra el assignedToId actual en Turso producción, para
 * detectar tickets mal asignados o sin asignar.
 *
 * 3 técnicos activos con cuenta: Sebastian Garrido, Juan Jesús Díaz,
 * Jesús Gonzales. Desvinculados sin cuenta: Alex Martinez, Clarence
 * Villablanca, Sergio Aliu, Vicente Garrido (no pueden recibir
 * assignedToId real — no tienen User).
 *
 * Run: npx tsx --env-file=.env.production.local scripts/audit-ticket-tecnico-match.ts
 */
import ExcelJS from 'exceljs'
import { prisma } from '../src/lib/prisma.js'

const FILE = 'justburger-ingegar/Fuente_Datos_Trabajos_JustBurger.xlsx'

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
function cell(row: ExcelJS.Row, i: number): unknown {
  const v = (row.values as unknown[])[i]
  if (v == null) return null
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

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FILE)
const wsTickets = wb.getWorksheet('Tickets')!

const excelByCode = new Map<string, string | null>()
for (let r = 2; r <= wsTickets.rowCount; r++) {
  const row = wsTickets.getRow(r)
  const code = str(cell(row, 1))
  if (!code) continue
  excelByCode.set(code, str(cell(row, 10)))
}
console.log(`Excel: ${excelByCode.size} tickets leídos.`)

// Active técnico users (email -> name)
const activeTecUsers = await prisma.user.findMany({
  where: { role: 'tecnico' },
  select: { id: true, name: true, email: true },
})
const sebastian = await prisma.user.findUnique({ where: { email: 'sgarrido@ingegarchile.cl' }, select: { id: true, name: true } })
const activeMap = new Map<string, { id: string; name: string }>()
for (const u of activeTecUsers) activeMap.set(norm(u.name), { id: u.id, name: u.name })
if (sebastian) activeMap.set(norm(sebastian.name), sebastian)
console.log('Técnicos activos con cuenta:', [...activeMap.values()].map(u => u.name).join(', '))

const tickets = await prisma.ticket.findMany({
  where: { ticketCode: { in: [...excelByCode.keys()] } },
  select: { id: true, ticketCode: true, status: true, assignedToId: true, assignedTo: { select: { name: true } } },
})
console.log(`Turso: ${tickets.length}/${excelByCode.size} tickets encontrados por código.\n`)

let matched = 0, mismatched = 0, unassignedInTurso = 0, excelTerminated = 0, excelNoTec = 0
const mismatches: { code: string; excelTec: string; tursoTec: string }[] = []
const toDefaultDiaz: string[] = []
const terminatedInExcel: { code: string; excelTec: string; tursoTec: string }[] = []

const TERMINATED_NAMES = ['alex martinez', 'alex martínez', 'clarence villablanca', 'clarence villablanca(2', 'sergio aliu', 'vicente garrido']

for (const t of tickets) {
  const excelTec = excelByCode.get(t.ticketCode)
  const tursoTec = t.assignedTo?.name ?? null

  if (!excelTec) { excelNoTec++; continue }
  const excelNorm = norm(excelTec)
  const activeMatch = activeMap.get(excelNorm)

  if (activeMatch) {
    if (t.assignedToId === activeMatch.id) {
      matched++
    } else {
      mismatched++
      mismatches.push({ code: t.ticketCode, excelTec, tursoTec: tursoTec ?? 'SIN ASIGNAR' })
    }
  } else if (TERMINATED_NAMES.some(n => excelNorm.includes(n.split(' ')[0]))) {
    excelTerminated++
    terminatedInExcel.push({ code: t.ticketCode, excelTec, tursoTec: tursoTec ?? 'SIN ASIGNAR' })
  } else {
    // Nombre en Excel no reconocido como activo ni desvinculado conocido
    mismatched++
    mismatches.push({ code: t.ticketCode, excelTec: `${excelTec} (¿?)`, tursoTec: tursoTec ?? 'SIN ASIGNAR' })
  }

  if (!t.assignedToId) { unassignedInTurso++; toDefaultDiaz.push(t.ticketCode) }
}

console.log(`Coinciden (Excel activo == Turso assignedToId): ${matched}`)
console.log(`NO coinciden (Excel dice otro técnico activo, o desconocido): ${mismatched}`)
console.log(`Excel = técnico desvinculado (sin cuenta, no puede ir en assignedToId): ${excelTerminated}`)
console.log(`Excel sin técnico registrado: ${excelNoTec}`)
console.log(`Actualmente SIN ASIGNAR en Turso (assignedToId null): ${unassignedInTurso}`)

console.log('\n=== Mismatches (Excel activo != Turso) ===')
for (const m of mismatches) console.log(`  ${m.code.padEnd(30)} Excel="${m.excelTec}" Turso="${m.tursoTec}"`)

console.log('\n=== Excel = desvinculado (histórico, sin cuenta) ===')
for (const m of terminatedInExcel.slice(0, 20)) console.log(`  ${m.code.padEnd(30)} Excel="${m.excelTec}" Turso="${m.tursoTec}"`)
if (terminatedInExcel.length > 20) console.log(`  ... y ${terminatedInExcel.length - 20} más`)

console.log('\n=== SIN ASIGNAR en Turso ahora mismo (candidatos a default Juan Jesús Díaz) ===')
for (const code of toDefaultDiaz) console.log(`  ${code}`)

await prisma.$disconnect()
