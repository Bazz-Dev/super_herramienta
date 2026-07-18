/**
 * Reconciliación Excel vs Turso producción — SOLO LECTURA
 * Compara los 83 tickets del Excel histórico contra lo que hay en Turso.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/reconcile-jb.ts
 */
import ExcelJS from 'exceljs'
import { createClient } from '@libsql/client'

const FILE = 'justburger-ingegar/Fuente_Datos_Trabajos_JustBurger.xlsx'

// ── helpers ────────────────────────────────────────────────────────────────────

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

// 'desconocido' cuando no es reconocible — nunca contarlo como 'resuelto' (enmascara diferencias).
function normalizeStatus(raw: unknown): string {
  const s = norm(str(raw) ?? '')
  if (s.includes('nuevo'))                              return 'nuevo'
  if (s.includes('revision') || s.includes('revisad')) return 'en_revision'
  if (s.includes('ejecucion') || s.includes('proceso')) return 'en_ejecucion'
  if (s.includes('esperando') || s.includes('aprobac')) return 'esperando_aprobacion'
  if (s.includes('cancelado') || s.includes('anulado')) return 'cancelado'
  if (s.includes('fusionado') || s.includes('merged'))  return 'fusionado'
  if (s.includes('resuelto') || s.includes('cerrado') || s.includes('completad') || s.includes('finalizad')) return 'resuelto'
  return 'desconocido'
}

// ── 1. Leer Excel ──────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════')
console.log('  RECONCILIACIÓN JB: Excel vs Turso Producción')
console.log('═══════════════════════════════════════════════════════\n')

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FILE)

const wsTickets = wb.getWorksheet('Tickets')!
const wsHist    = wb.getWorksheet('Historial')!

// Urgencia Excel → enum Turso. 'desconocido' si no calza (nunca adivinar).
function normalizeUrgency(raw: unknown): string {
  const s = norm(str(raw) ?? '')
  if (!s) return 'desconocido'
  if (s.includes('no urgente') || s.includes('no_urgente')) return 'no_urgente'
  if (s.includes('emerg'))   return 'emergencia'
  if (s.includes('prevent')) return 'preventivo'
  if (s.includes('urgen'))   return 'urgencia'
  return 'desconocido'
}

interface ExcelTicket {
  code:     string
  status:   string
  rawStatus: string
  tecnico:  string | null
  sucursal: string | null
  urgencia: string
  ot:       string | null
  adjuntos: string | null
  createdAt: Date | null
  closedAt:  Date | null
  ultimaAct: Date | null
}

const excelTickets = new Map<string, ExcelTicket>()
for (let r = 2; r <= wsTickets.rowCount; r++) {
  const row = wsTickets.getRow(r)
  const code = str(cell(row, 1))
  if (!code) continue
  const rawStatus = str(cell(row, 5)) ?? ''
  excelTickets.set(code, {
    code,
    status:    normalizeStatus(rawStatus),
    rawStatus,
    tecnico:   str(cell(row, 10)),
    sucursal:  str(cell(row, 3)),
    urgencia:  normalizeUrgency(cell(row, 4)),
    ot:        str(cell(row, 22)),
    adjuntos:  str(cell(row, 13)),
    createdAt: cell(row, 2) instanceof Date ? cell(row, 2) as Date : null,
    closedAt:  cell(row, 9) instanceof Date ? cell(row, 9) as Date : null,
    ultimaAct: cell(row, 15) instanceof Date ? cell(row, 15) as Date : null,
  })
}

// Historial en Excel por ticketCode
const excelHistCount = new Map<string, number>()
for (let r = 2; r <= wsHist.rowCount; r++) {
  const code = str(cell(wsHist.getRow(r), 1))
  if (!code) continue
  excelHistCount.set(code, (excelHistCount.get(code) ?? 0) + 1)
}

console.log(`📄 EXCEL`)
console.log(`   Total tickets:  ${excelTickets.size}`)
console.log(`   Total historial: ${[...excelHistCount.values()].reduce((a, b) => a + b, 0)} filas`)

const excelByStatus: Record<string, number> = {}
for (const t of excelTickets.values()) {
  excelByStatus[t.status] = (excelByStatus[t.status] ?? 0) + 1
}
console.log(`   Por estado:     ${JSON.stringify(excelByStatus)}`)
console.log()

// ── 2. Leer Turso ──────────────────────────────────────────────────────────────

const db = createClient({
  url:       process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// Verificar conexión
const ping = await db.execute('SELECT 1 as ok')
if ((ping.rows[0] as Record<string, unknown>)['ok'] !== 1) throw new Error('No se pudo conectar a Turso')

// Obtener clientId de JB (tabla: "clients" por @@map)
const clientRow = await db.execute(
  `SELECT id, name FROM clients WHERE portalSlug = 'justburger' LIMIT 1`
)
if (!clientRow.rows.length) throw new Error('Cliente justburger no encontrado en Turso')
const jbClientId = clientRow.rows[0]['id'] as string
const jbClientName = clientRow.rows[0]['name'] as string
console.log(`🌐 TURSO — Cliente: ${jbClientName} (${jbClientId})`)

// Todos los tickets JB (tablas: tickets, users, branches)
const tursoRes = await db.execute(
  `SELECT t.ticketCode, t.status, t.urgency, t.otNumber, t.assignedToId, t.createdAt, t.updatedAt, t.closedDate, t.showToClient,
          u.name as tecnicoNombre,
          b.name as sucursalNombre
   FROM tickets t
   LEFT JOIN users u ON u.id = t.assignedToId
   LEFT JOIN branches b ON b.id = t.branchId
   WHERE t.clientId = '${jbClientId}'
   ORDER BY t.createdAt ASC`
)

interface TursoTicket {
  ticketCode:    string
  status:        string
  urgency:       string
  otNumber:      string | null
  assignedToId:  string | null
  createdAt:     string
  updatedAt:     string
  closedDate:    string | null
  showToClient:  number
  tecnicoNombre: string | null
  sucursalNombre: string | null
}

const tursoTickets = new Map<string, TursoTicket>()
for (const r of tursoRes.rows) {
  const t = r as unknown as TursoTicket
  tursoTickets.set(t.ticketCode, t)
}

// Historial en Turso por ticketCode (tablas: ticket_history, tickets)
const histRes = await db.execute(
  `SELECT t.ticketCode, COUNT(h.id) as cnt
   FROM ticket_history h
   JOIN tickets t ON t.id = h.ticketId
   WHERE t.clientId = '${jbClientId}'
   GROUP BY t.ticketCode`
)
const tursoHistCount = new Map<string, number>()
for (const r of histRes.rows) {
  tursoHistCount.set(r['ticketCode'] as string, Number(r['cnt']))
}

// Documentos (R2) por ticketCode en Turso
const docRes = await db.execute(
  `SELECT t.ticketCode, COUNT(d.id) as cnt
   FROM ticket_documents d
   JOIN tickets t ON t.id = d.ticketId
   WHERE t.clientId = '${jbClientId}'
   GROUP BY t.ticketCode`
)
const tursoDocCount = new Map<string, number>()
for (const r of docRes.rows) tursoDocCount.set(r['ticketCode'] as string, Number(r['cnt']))

// Historial completo para detectar eventos duplicados (mismo ticket+minuto+nota)
const histFullRes = await db.execute(
  `SELECT t.ticketCode, h.createdAt, h.note
   FROM ticket_history h
   JOIN tickets t ON t.id = h.ticketId
   WHERE t.clientId = '${jbClientId}'`
)
// Nota completa (sin truncar): un corte corto produce falsos positivos cuando dos
// eventos DISTINTOS de un mismo ticket fusionado (p.ej. mismo título, "estado"
// distinto) sólo difieren después del punto de corte. Bug real encontrado
// 2026-07-18: truncar a 80 chars marcaba como "duplicado" un evento "pendiente"
// y su correspondiente "resuelto" del mismo sub-ticket fusionado.
const histKeyCount = new Map<string, number>()
for (const r of histFullRes.rows) {
  const ts = new Date(r['createdAt'] as string).getTime()
  const key = `${r['ticketCode']}|${Math.floor(ts / 60000)}|${(r['note'] as string | null) ?? ''}`
  histKeyCount.set(key, (histKeyCount.get(key) ?? 0) + 1)
}
const histDuplicados = [...histKeyCount.entries()].filter(([, n]) => n > 1)

// Estado por status en Turso
const tursoByStatus: Record<string, number> = {}
for (const t of tursoTickets.values()) {
  tursoByStatus[t.status] = (tursoByStatus[t.status] ?? 0) + 1
}

console.log(`   Total tickets:  ${tursoTickets.size}`)
console.log(`   Total historial: ${[...tursoHistCount.values()].reduce((a, b) => a + b, 0)} filas`)
console.log(`   Por estado:     ${JSON.stringify(tursoByStatus)}`)
console.log()

// ── 3. Análisis ────────────────────────────────────────────────────────────────

const excelCodes  = new Set(excelTickets.keys())
const tursoCodes  = new Set(tursoTickets.keys())

// 3a. Faltantes en Turso (en Excel pero no en Turso)
const faltantesEnTurso = [...excelCodes].filter(c => !tursoCodes.has(c))

// 3b. En Turso pero no en Excel (creados directamente en INGEGAR One)
const soloEnTurso = [...tursoCodes].filter(c => !excelCodes.has(c))

// 3c. Duplicados en Excel (ticketCodes repetidos)
// (ya los detecta el Map — si hay dups el Map solo guarda el último)
const allExcelCodes: string[] = []
for (let r = 2; r <= wsTickets.rowCount; r++) {
  const code = str(cell(wsTickets.getRow(r), 1))
  if (code) allExcelCodes.push(code)
}
const duplicadosExcel = allExcelCodes.filter((c, i) => allExcelCodes.indexOf(c) !== i)

// 3d. Diferencias de estado entre Excel y Turso
interface DifEstado { code: string; excel: string; turso: string }
const difEstado: DifEstado[] = []
for (const [code, et] of excelTickets) {
  const tt = tursoTickets.get(code)
  if (!tt) continue
  if (et.status !== tt.status) {
    difEstado.push({ code, excel: et.status, turso: tt.status })
  }
}

// 3e. Tickets sin técnico en Turso
const sinTecnicoTurso = [...tursoTickets.values()].filter(t => !t.assignedToId)

// 3f. Tickets sin historial en Turso (pero que existen en Turso)
const sinHistTurso = [...tursoTickets.keys()].filter(c => !tursoHistCount.has(c))

// 3g. Diferencia de conteo de historial
interface DifHist { code: string; excel: number; turso: number }
const difHist: DifHist[] = []
for (const [code] of excelTickets) {
  const tt = tursoTickets.get(code)
  if (!tt) continue
  const excelH = excelHistCount.get(code) ?? 0
  const tursoH = tursoHistCount.get(code) ?? 0
  if (Math.abs(excelH - tursoH) > 2) {  // tolerancia de 2 para pequeñas variaciones
    difHist.push({ code, excel: excelH, turso: tursoH })
  }
}

// 3h. Tickets con fecha creación sospechosa en Turso (importados con fecha de hoy)
const hoy = new Date()
const hace7dias = new Date(hoy.getTime() - 7 * 86_400_000)
const fechaSospechosa = [...tursoTickets.entries()]
  .filter(([code]) => excelCodes.has(code))
  .filter(([, t]) => {
    const d = new Date(t.createdAt)
    return d > hace7dias
  })

// 3i. Diferencia de técnico asignado
interface DifTec { code: string; excelTec: string | null; tursoTec: string | null }
const difTecnico: DifTec[] = []
for (const [code, et] of excelTickets) {
  const tt = tursoTickets.get(code)
  if (!tt) continue
  const excelNorm = et.tecnico ? norm(et.tecnico) : null
  const tursoNorm = tt.tecnicoNombre ? norm(tt.tecnicoNombre) : null
  if (excelNorm !== tursoNorm) {
    difTecnico.push({ code, excelTec: et.tecnico, tursoTec: tt.tecnicoNombre })
  }
}

// 3j. Diferencias de sucursal / urgencia / OT (solo tickets coincidentes)
interface DifCampo { code: string; excel: string; turso: string }
const difSucursal: DifCampo[] = []
const difUrgencia: DifCampo[] = []
const difOT:       DifCampo[] = []
for (const [code, et] of excelTickets) {
  const tt = tursoTickets.get(code)
  if (!tt) continue
  const es = et.sucursal ? norm(et.sucursal) : ''
  const ts = tt.sucursalNombre ? norm(tt.sucursalNombre) : ''
  // containment en ambos sentidos: "Providencia" vs "JB Providencia"
  if (es !== ts && !(es && ts && (es.includes(ts) || ts.includes(es)))) {
    difSucursal.push({ code, excel: et.sucursal ?? '—', turso: tt.sucursalNombre ?? '—' })
  }
  if (et.urgencia !== 'desconocido' && et.urgencia !== tt.urgency) {
    difUrgencia.push({ code, excel: et.urgencia, turso: tt.urgency })
  }
  const eo = et.ot?.trim() ?? ''
  const to = tt.otNumber?.trim() ?? ''
  if (eo !== to) difOT.push({ code, excel: eo || '—', turso: to || '—' })
}

// 3k. Última modificación por fuente (clave para la fecha de corte)
let excelMasNuevo = 0, tursoMasNuevo = 0, sinUltimaAct = 0
let maxExcelAct: Date | null = null, maxTursoAct: Date | null = null
const excelNuevoDetalle: { code: string; excel: string; turso: string }[] = []
for (const [code, et] of excelTickets) {
  const tt = tursoTickets.get(code)
  if (!tt) continue
  const tu = new Date(tt.updatedAt)
  if (maxTursoAct === null || tu > maxTursoAct) maxTursoAct = tu
  if (!et.ultimaAct) { sinUltimaAct++; continue }
  if (maxExcelAct === null || et.ultimaAct > maxExcelAct) maxExcelAct = et.ultimaAct
  if (et.ultimaAct > tu) {
    excelMasNuevo++
    excelNuevoDetalle.push({ code, excel: et.ultimaAct.toISOString().slice(0, 16), turso: tu.toISOString().slice(0, 16) })
  } else {
    tursoMasNuevo++
  }
}

// 3l. Sospecha timezone: fecha creación difiere entre 1 min y 25 h entre fuentes
const tzSospechosa: { code: string; excel: string; turso: string; difH: string }[] = []
for (const [code, et] of excelTickets) {
  const tt = tursoTickets.get(code)
  if (!tt || !et.createdAt) continue
  const difMs = Math.abs(et.createdAt.getTime() - new Date(tt.createdAt).getTime())
  if (difMs > 60_000 && difMs <= 25 * 3_600_000) {
    tzSospechosa.push({
      code,
      excel: et.createdAt.toISOString().slice(0, 16),
      turso: new Date(tt.createdAt).toISOString().slice(0, 16),
      difH: (difMs / 3_600_000).toFixed(1),
    })
  }
}

// 3m. Adjuntos declarados en Excel sin documento en Turso (relación archivo↔dato perdida)
const adjuntosSinDoc = [...excelTickets.values()]
  .filter(et => et.adjuntos && tursoCodes.has(et.code))
  .filter(et => (tursoDocCount.get(et.code) ?? 0) === 0)

// ── 4. Reporte ─────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════')
console.log('  REPORTE DE RECONCILIACIÓN')
console.log('═══════════════════════════════════════════════════════\n')

const matched = [...excelCodes].filter(c => tursoCodes.has(c)).length

console.log(`1. COBERTURA`)
console.log(`   Excel:          ${excelTickets.size} tickets`)
console.log(`   Turso prod:     ${tursoTickets.size} tickets`)
console.log(`   Coincidentes:   ${matched}`)
console.log(`   Faltantes (Excel→Turso): ${faltantesEnTurso.length}`)
console.log(`   Solo en Turso:  ${soloEnTurso.length} (creados desde INGEGAR One)`)
console.log()

if (faltantesEnTurso.length > 0) {
  console.log(`2. TICKETS FALTANTES EN TURSO (${faltantesEnTurso.length}):`)
  for (const code of faltantesEnTurso) {
    const et = excelTickets.get(code)!
    console.log(`   - ${code} | estado:${et.rawStatus} | tec:${et.tecnico ?? '—'}`)
  }
  console.log()
}

if (duplicadosExcel.length > 0) {
  console.log(`3. DUPLICADOS EN EXCEL (${duplicadosExcel.length}):`)
  duplicadosExcel.forEach(c => console.log(`   - ${c}`))
  console.log()
}

console.log(`4. DIFERENCIAS DE ESTADO (${difEstado.length}):`)
if (difEstado.length === 0) {
  console.log(`   ✓ Ninguna`)
} else {
  difEstado.slice(0, 20).forEach(d =>
    console.log(`   - ${d.code}: Excel="${d.excel}" vs Turso="${d.turso}"`)
  )
  if (difEstado.length > 20) console.log(`   ... y ${difEstado.length - 20} más`)
}
console.log()

console.log(`5. DIFERENCIAS DE TÉCNICO (${difTecnico.length}):`)
if (difTecnico.length === 0) {
  console.log(`   ✓ Ninguna`)
} else {
  difTecnico.slice(0, 15).forEach(d =>
    console.log(`   - ${d.code}: Excel="${d.excelTec ?? '—'}" vs Turso="${d.tursoTec ?? '—'}"`)
  )
  if (difTecnico.length > 15) console.log(`   ... y ${difTecnico.length - 15} más`)
}
console.log()

console.log(`6. SIN TÉCNICO EN TURSO (${sinTecnicoTurso.length}):`)
if (sinTecnicoTurso.length === 0) {
  console.log(`   ✓ Ninguno`)
} else {
  sinTecnicoTurso.slice(0, 10).forEach(t =>
    console.log(`   - ${t.ticketCode} | ${t.status}`)
  )
  if (sinTecnicoTurso.length > 10) console.log(`   ... y ${sinTecnicoTurso.length - 10} más`)
}
console.log()

console.log(`7. HISTORIAL — TICKETS SIN ENTRADAS EN TURSO (${sinHistTurso.length}):`)
if (sinHistTurso.length === 0) {
  console.log(`   ✓ Ninguno`)
} else {
  sinHistTurso.slice(0, 10).forEach(c => console.log(`   - ${c}`))
}
console.log()

console.log(`8. DIFERENCIAS DE CONTEO DE HISTORIAL (${difHist.length}):`)
if (difHist.length === 0) {
  console.log(`   ✓ Dentro de tolerancia`)
} else {
  difHist.slice(0, 15).forEach(d =>
    console.log(`   - ${d.code}: Excel=${d.excel} vs Turso=${d.turso}`)
  )
}
console.log()

console.log(`9. FECHAS CREACIÓN SOSPECHOSAS EN TURSO (${fechaSospechosa.length}):`)
console.log(`   (tickets históricos con fecha de creación en los últimos 7 días)`)
if (fechaSospechosa.length === 0) {
  console.log(`   ✓ Ninguna`)
} else {
  fechaSospechosa.slice(0, 10).forEach(([code, t]) =>
    console.log(`   - ${code}: ${new Date(t.createdAt).toISOString().slice(0, 10)}`)
  )
}
console.log()

// 10. Tickets solo en Turso (nuevos desde portal)
console.log(`10. TICKETS CREADOS EN INGEGAR ONE (solo en Turso, ${soloEnTurso.length}):`)
const soloPorStatus: Record<string, number> = {}
for (const code of soloEnTurso) {
  const t = tursoTickets.get(code)!
  soloPorStatus[t.status] = (soloPorStatus[t.status] ?? 0) + 1
}
console.log(`    Por estado: ${JSON.stringify(soloPorStatus)}`)
console.log(`    Ejemplos: ${JSON.stringify(soloEnTurso.slice(0, 5))}`)
console.log()

console.log(`11. DIFERENCIAS DE SUCURSAL (${difSucursal.length}):`)
difSucursal.slice(0, 10).forEach(d => console.log(`   - ${d.code}: Excel="${d.excel}" vs Turso="${d.turso}"`))
console.log()

console.log(`12. DIFERENCIAS DE URGENCIA (${difUrgencia.length}):`)
difUrgencia.slice(0, 10).forEach(d => console.log(`   - ${d.code}: Excel="${d.excel}" vs Turso="${d.turso}"`))
console.log()

console.log(`13. DIFERENCIAS DE OT (${difOT.length}):`)
difOT.slice(0, 10).forEach(d => console.log(`   - ${d.code}: Excel="${d.excel}" vs Turso="${d.turso}"`))
console.log()

console.log(`14. ÚLTIMA MODIFICACIÓN POR FUENTE (tickets coincidentes):`)
console.log(`   Excel más nuevo que Turso: ${excelMasNuevo} | Turso más nuevo: ${tursoMasNuevo} | sin Ultima_Actualizacion en Excel: ${sinUltimaAct}`)
console.log(`   Actividad más reciente — Excel: ${maxExcelAct?.toISOString().slice(0, 16) ?? '—'} | Turso: ${maxTursoAct?.toISOString().slice(0, 16) ?? '—'}`)
excelNuevoDetalle.slice(0, 10).forEach(d => console.log(`   - ${d.code}: Excel=${d.excel} > Turso=${d.turso}`))
console.log()

console.log(`15. SOSPECHA TIMEZONE — creación difiere 1min–25h entre fuentes (${tzSospechosa.length}):`)
tzSospechosa.slice(0, 10).forEach(d => console.log(`   - ${d.code}: Excel=${d.excel} vs Turso=${d.turso} (${d.difH}h)`))
console.log()

console.log(`16. ADJUNTOS EXCEL SIN DOCUMENTO EN TURSO (${adjuntosSinDoc.length}):`)
adjuntosSinDoc.slice(0, 10).forEach(et => console.log(`   - ${et.code}: "${(et.adjuntos ?? '').slice(0, 60)}"`))
console.log()

console.log(`17. EVENTOS DE HISTORIAL DUPLICADOS EN TURSO (${histDuplicados.length}):`)
histDuplicados.slice(0, 10).forEach(([k, n]) => console.log(`   - ${k.split('|')[0]} ×${n}: "${k.split('|')[2].slice(0, 80)}"`))
console.log()

// Resumen ejecutivo
console.log('═══════════════════════════════════════════════════════')
console.log('  RESUMEN EJECUTIVO')
console.log('═══════════════════════════════════════════════════════')
const ok    = faltantesEnTurso.length === 0
const warns = [
  difEstado.length > 0    && `${difEstado.length} dif. estado`,
  difTecnico.length > 0   && `${difTecnico.length} dif. técnico`,
  sinHistTurso.length > 0 && `${sinHistTurso.length} sin historial`,
  difHist.length > 0      && `${difHist.length} dif. historial`,
  fechaSospechosa.length > 0 && `${fechaSospechosa.length} fechas sospechosas`,
  difSucursal.length > 0  && `${difSucursal.length} dif. sucursal`,
  difUrgencia.length > 0  && `${difUrgencia.length} dif. urgencia`,
  difOT.length > 0        && `${difOT.length} dif. OT`,
  tzSospechosa.length > 0 && `${tzSospechosa.length} sospecha TZ`,
  adjuntosSinDoc.length > 0 && `${adjuntosSinDoc.length} adjuntos sin doc`,
  histDuplicados.length > 0 && `${histDuplicados.length} historial duplicado`,
  excelMasNuevo > 0       && `${excelMasNuevo} tickets con Excel más nuevo`,
].filter(Boolean)

if (ok && warns.length === 0) {
  console.log('  ✅ PASS — Import completo y consistente')
} else if (!ok) {
  console.log(`  ❌ FALLO — ${faltantesEnTurso.length} tickets faltantes en Turso`)
  if (warns.length > 0) console.log(`  ⚠️  Advertencias: ${warns.join(', ')}`)
} else {
  console.log(`  ⚠️  ADVERTENCIAS: ${warns.join(', ')}`)
}
console.log()

await db.close()
