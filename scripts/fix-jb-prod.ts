/**
 * Migración de fidelidad completa Excel → Turso (datos JB).
 * Basada en la reconciliación real del 2026-07-17:
 *   A) Estados: sincroniza si difieren (la reconciliación dio 0 — corre como verificación)
 *   B) Urgencias: restaura la urgencia del Excel donde difiera (28 casos sistemáticos del import)
 *   C) Técnico histórico: donde el técnico del Excel ≠ Turso, agrega entrada de historial
 *      "Técnico histórico (fuente Excel): X" SIN tocar assignedToId (regla ratificada)
 *   D) Historial faltante: inserta entradas del Excel que no existen en Turso (dedup minuto+nota);
 *      lo que Turso tiene de más NUNCA se toca
 *   E) Duplicados exactos de historial en Turso (mismo ticket+minuto+nota ×2): conserva el más
 *      antiguo de cada grupo y elimina el resto (3 pares detectados)
 *
 * Dry-run por defecto. Escribe SOLO con --apply.
 * Run: npx tsx --env-file=.env.production.local scripts/fix-jb-prod.ts [--apply]
 */
import ExcelJS from 'exceljs'
import { createClient } from '@libsql/client'

const FILE = 'justburger-ingegar/Fuente_Datos_Trabajos_JustBurger.xlsx'

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
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
// Devuelve null cuando el estado no es reconocible — NUNCA inventar 'resuelto'.
function normalizeStatus(raw: unknown): string | null {
  const s = norm(str(raw) ?? '')
  if (s.includes('nuevo'))                              return 'nuevo'
  if (s.includes('revision') || s.includes('revisad')) return 'en_revision'
  if (s.includes('ejecucion') || s.includes('proceso')) return 'en_ejecucion'
  if (s.includes('esperando') || s.includes('aprobac')) return 'esperando_aprobacion'
  if (s.includes('cancelado') || s.includes('anulado')) return 'cancelado'
  if (s.includes('fusionado') || s.includes('merged'))  return 'fusionado'
  if (s.includes('resuelto') || s.includes('cerrado') || s.includes('completad') || s.includes('finalizad')) return 'resuelto'
  return null
}

// Urgencia Excel → enum Turso. null si no es reconocible (nunca adivinar).
function normalizeUrgency(raw: unknown): string | null {
  const s = norm(str(raw) ?? '')
  if (!s) return null
  if (s.includes('no urgente') || s.includes('no_urgente')) return 'no_urgente'
  if (s.includes('emerg'))   return 'emergencia'
  if (s.includes('prevent')) return 'preventivo'
  if (s.includes('urgen'))   return 'urgencia'
  return null
}

// Dry-run por defecto: solo escribe en Turso con --apply explícito.
const APPLY = process.argv.includes('--apply')
const TAG = APPLY ? '✏' : '[dry-run]'

// ── Conectar a Turso ──────────────────────────────────────────────────────────
const db = createClient({
  url:       process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})
const ping = await db.execute('SELECT 1 as ok')
if ((ping.rows[0] as Record<string, unknown>)['ok'] !== 1) throw new Error('No conecta a Turso')

const clientRow = await db.execute(`SELECT id FROM clients WHERE portalSlug = 'justburger' LIMIT 1`)
if (!clientRow.rows.length) throw new Error('Cliente justburger no encontrado')
const jbClientId = clientRow.rows[0]['id'] as string

// Cargar todos los tickets JB de Turso: ticketCode → { id, status, urgency, tecnicoNombre }
const tursoRows = await db.execute(
  `SELECT t.id, t.ticketCode, t.status, t.urgency, u.name as tecnicoNombre
   FROM tickets t LEFT JOIN users u ON u.id = t.assignedToId
   WHERE t.clientId = '${jbClientId}'`
)
const tursoMap = new Map<string, { id: string; status: string; urgency: string; tecnicoNombre: string | null }>()
for (const r of tursoRows.rows) {
  tursoMap.set(r['ticketCode'] as string, {
    id: r['id'] as string,
    status: r['status'] as string,
    urgency: r['urgency'] as string,
    tecnicoNombre: (r['tecnicoNombre'] as string | null) ?? null,
  })
}
console.log(`✓ Turso cargado: ${tursoMap.size} tickets JB`)

// ── Leer Excel ────────────────────────────────────────────────────────────────
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(FILE)
const wsT = wb.getWorksheet('Tickets')!
const wsH = wb.getWorksheet('Historial')!

// ── A. Actualizar estados ────────────────────────────────────────────────────
console.log('\n═══ A. ACTUALIZACIÓN DE ESTADOS ═══')

let stateUpdated = 0, stateSkipped = 0, stateInvalid = 0

for (let r = 2; r <= wsT.rowCount; r++) {
  const row  = wsT.getRow(r)
  const code = str(cell(row, 1))
  if (!code) continue

  const excelStatus = normalizeStatus(cell(row, 5))
  const turso       = tursoMap.get(code)
  if (!turso) continue                          // no está en Turso (no debería pasar)

  if (excelStatus === null) {
    console.log(`   ⚠ ${code}: estado Excel no reconocible ("${str(cell(row, 5)) ?? ''}") — dato inválido en fuente, NO se toca`)
    stateInvalid++
    continue
  }

  if (turso.status === excelStatus) { stateSkipped++; continue }

  // Actualizar estado
  if (APPLY) {
    await db.execute({
      sql:  `UPDATE tickets SET status = ?, updatedAt = ? WHERE id = ?`,
      args: [excelStatus, new Date().toISOString(), turso.id],
    })
  }
  console.log(`   ${APPLY ? '✏' : '[dry-run]'} ${code}: ${turso.status} → ${excelStatus}`)
  stateUpdated++
  tursoMap.get(code)!.status = excelStatus      // actualizar cache local
}

console.log(`   Resultado: ${stateUpdated} ${APPLY ? 'actualizados' : 'por actualizar (dry-run)'} | ${stateSkipped} ya coincidían | ${stateInvalid} con estado inválido en fuente`)

// ── B. Restaurar urgencias del Excel ─────────────────────────────────────────
console.log('\n═══ B. URGENCIAS (fidelidad Excel) ═══')
let urgUpdated = 0, urgSkipped = 0, urgUnknown = 0
for (let r = 2; r <= wsT.rowCount; r++) {
  const row  = wsT.getRow(r)
  const code = str(cell(row, 1))
  if (!code) continue
  const turso = tursoMap.get(code)
  if (!turso) continue
  const exU = normalizeUrgency(cell(row, 4))
  if (exU === null) { urgUnknown++; continue }
  if (turso.urgency === exU) { urgSkipped++; continue }
  if (APPLY) {
    await db.execute({ sql: `UPDATE tickets SET urgency = ? WHERE id = ?`, args: [exU, turso.id] })
  }
  console.log(`   ${TAG} ${code}: urgencia ${turso.urgency} → ${exU}`)
  urgUpdated++
}
console.log(`   Resultado: ${urgUpdated} ${APPLY ? 'restauradas' : 'por restaurar'} | ${urgSkipped} ya coincidían | ${urgUnknown} sin urgencia reconocible en Excel`)

// ── C. Técnico histórico como entrada de historial (NO toca assignedToId) ────
console.log('\n═══ C. TÉCNICO HISTÓRICO (fuente Excel → historial) ═══')
let tecAdded = 0, tecSkipped = 0
for (let r = 2; r <= wsT.rowCount; r++) {
  const row  = wsT.getRow(r)
  const code = str(cell(row, 1))
  if (!code) continue
  const turso = tursoMap.get(code)
  if (!turso) continue
  const exTec = str(cell(row, 10))
  if (!exTec) continue
  if (norm(exTec) === norm(turso.tecnicoNombre ?? '')) { tecSkipped++; continue }
  const note = `Técnico histórico (fuente Excel): ${exTec}`
  const existing = await db.execute({
    sql: `SELECT id FROM ticket_history WHERE ticketId = ? AND note = ? LIMIT 1`,
    args: [turso.id, note],
  })
  if (existing.rows.length) { tecSkipped++; continue }
  if (APPLY) {
    const newId = `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    await db.execute({
      sql: `INSERT INTO ticket_history (id, ticketId, note, isInternal, createdAt) VALUES (?, ?, ?, 1, ?)`,
      args: [newId, turso.id, note, new Date().toISOString()],
    })
  }
  console.log(`   ${TAG} ${code}: "${note}" (Turso: ${turso.tecnicoNombre ?? 'sin asignar'})`)
  tecAdded++
}
console.log(`   Resultado: ${tecAdded} ${APPLY ? 'anotados' : 'por anotar'} | ${tecSkipped} coinciden o ya anotados`)

// ── D. Completar historial faltante del Excel ────────────────────────────────
console.log('\n═══ D. HISTORIAL FALTANTE DEL EXCEL ═══')

// Pre-cargar historial existente en Turso por ticket (Set de "minuto:nota")
const existingKeys = new Map<string, Set<string>>()  // ticketId → Set<key>
for (const [, { id }] of tursoMap) {
  if (existingKeys.has(id)) continue
  const rows = await db.execute({
    sql:  `SELECT createdAt, note FROM ticket_history WHERE ticketId = ?`,
    args: [id],
  })
  existingKeys.set(id, new Set(
    rows.rows.map(h => {
      const ts = new Date(h['createdAt'] as string).getTime()
      return `${Math.floor(ts / 60000)}:${((h['note'] as string | null) ?? '').slice(0, 100)}`
    })
  ))
}
console.log(`   Historial pre-cargado para ${existingKeys.size} tickets`)

let histInserted = 0, histSkipped = 0, histMissing = 0, histBadDate = 0

for (let r = 2; r <= wsH.rowCount; r++) {
  const row  = wsH.getRow(r)
  const code = str(cell(row, 1))
  if (!code) continue

  const turso = tursoMap.get(code)
  if (!turso) { histMissing++; continue }   // código no encontrado en Turso

  const rawDate = cell(row, 2)
  if (!(rawDate instanceof Date)) {
    // Fecha histórica inválida en fuente → NO inventar new Date(); se salta y se reporta.
    console.log(`   ⚠ ${code} fila ${r}: fecha inválida en Excel ("${str(rawDate) ?? ''}") — se omite`)
    histBadDate++
    continue
  }
  const createdAt = rawDate
  const note      = str(cell(row, 6))
  const key       = `${Math.floor(createdAt.getTime() / 60000)}:${(note ?? '').slice(0, 100)}`
  const keySet    = existingKeys.get(turso.id)!

  if (keySet.has(key)) { histSkipped++; continue }

  // Normalizar estados del historial
  const fromStatus = (() => {
    const s = norm(str(cell(row, 3)) ?? '')
    if (!s) return null
    return normalizeStatus(s)
  })()
  const toStatus = (() => {
    const s = norm(str(cell(row, 4)) ?? '')
    if (!s) return null
    return normalizeStatus(s)
  })()

  if (APPLY) {
    const newId = `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    await db.execute({
      sql: `INSERT INTO ticket_history (id, ticketId, fromStatus, toStatus, note, isInternal, createdAt)
            VALUES (?, ?, ?, ?, ?, 0, ?)`,
      args: [newId, turso.id, fromStatus, toStatus, note, createdAt.toISOString()],
    })
  }
  keySet.add(key)
  histInserted++
}

console.log(`   Resultado: ${histInserted} ${APPLY ? 'insertadas' : 'por insertar (dry-run)'} | ${histSkipped} ya existían | ${histMissing} sin ticket en Turso | ${histBadDate} con fecha inválida en fuente`)

// ── E. Eliminar duplicados EXACTOS de historial (conserva el más antiguo) ─────
console.log('\n═══ E. HISTORIAL DUPLICADO EN TURSO ═══')
const allHist = await db.execute(
  `SELECT h.id, h.ticketId, h.createdAt, h.note, t.ticketCode
   FROM ticket_history h JOIN tickets t ON t.id = h.ticketId
   WHERE t.clientId = '${jbClientId}' ORDER BY h.createdAt ASC`
)
const groups = new Map<string, { id: string; code: string }[]>()
for (const r of allHist.rows) {
  const ts = new Date(r['createdAt'] as string).getTime()
  const key = `${r['ticketId']}|${Math.floor(ts / 60000)}|${((r['note'] as string | null) ?? '').slice(0, 100)}`
  const arr = groups.get(key) ?? []
  arr.push({ id: r['id'] as string, code: r['ticketCode'] as string })
  groups.set(key, arr)
}
let dupRemoved = 0
for (const [, arr] of groups) {
  if (arr.length < 2) continue
  // ORDER BY createdAt ASC → arr[0] es el más antiguo; se eliminan los demás
  for (const extra of arr.slice(1)) {
    if (APPLY) await db.execute({ sql: `DELETE FROM ticket_history WHERE id = ?`, args: [extra.id] })
    console.log(`   ${TAG} ${extra.code}: duplicado eliminado (${extra.id})`)
    dupRemoved++
  }
}
console.log(`   Resultado: ${dupRemoved} ${APPLY ? 'eliminados' : 'por eliminar'} (se conserva siempre el más antiguo)`)

// ── Resumen ───────────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════')
console.log('  RESUMEN')
console.log('═══════════════════════════════════════════════════════')
console.log(`  Modo:              ${APPLY ? 'APPLY (escrituras reales)' : 'DRY-RUN (nada escrito)'}`)
console.log(`  Estados:           ${stateUpdated}`)
console.log(`  Urgencias:         ${urgUpdated}`)
console.log(`  Técnico histórico: ${tecAdded}`)
console.log(`  Historial nuevo:   ${histInserted}`)
console.log(`  Duplicados fuera:  ${dupRemoved}`)
console.log()

await db.close()
