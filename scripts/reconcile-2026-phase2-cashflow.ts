/**
 * Reconciliación 2026 — Fase 2: Flujo de Caja, CSV consolidado → Turso.
 * Fuente única: justburger-ingegar/ingegar_one_flujo_consolidado_2026.csv
 * (NO se vuelven a procesar los XLSX históricos). Todos los clientes.
 *
 * source_ref (ej. "JB:JULIO:49") es único por fila en el CSV, pero NO
 * coincide con ningún importRef ya usado en Turso (esquemas previos:
 * "JB#Hoja#fila" del import original, "FLUJO2026B-CLI#..." de la
 * reconciliación de julio) — así que para encontrar un Job ya existente se
 * usa la misma jerarquía de matching por contenido de siempre (costCenter
 * exacto -> factura -> fuzzy cliente+sucursal+fecha+monto), NO source_ref.
 * source_ref sí se guarda como importRef en los Job nuevos, para que una
 * segunda corrida de ESTE script sea idempotente contra sí misma.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase2-cashflow.ts
 *      npx tsx --env-file=.env.production.local scripts/reconcile-2026-phase2-cashflow.ts --apply
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'
import { normalizeBranchName, normalizeType, parseMoneyCLP, parseCreditDays } from '../src/lib/cashflow/normalize.js'
import { deriveJobStatus, deriveCollectionStatus } from '../src/lib/cashflow/derive-legacy-status.js'
import { generateJobCode, clientCodeFrom, JOB_TYPE_CODE } from '../src/lib/cashflow/generate-code.js'
import type { FinancialStage } from '../src/generated/prisma/enums.js'

const CSV_PATH = 'justburger-ingegar/ingegar_one_flujo_consolidado_2026.csv'
const APPLY = process.argv.includes('--apply')

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

// CSV cliente -> nombre real en Turso. "Decathlon Chile"/"Unity Fit" eran
// duplicados confirmados (misma sucursal física bajo ambos nombres — "La
// Dehesa" y la dirección Libertad 22 respectivamente) y ya se fusionaron
// contra "Decathlon"/"Unity" (ver scripts/_merge-duplicate-clients.ts,
// aplicado 2026-07-28). "Pandora (JLL)"/"Alcon Laboratorios Chile (JLL)" NO
// son duplicados pese al sufijo compartido — sucursales completamente
// distintas (Pandora: 10 malls reales de joyería; Alcon: ninguna) — son dos
// empresas reales que JLL administra/factura en conjunto, no la misma.
const CLIENT_MAP: Record<string, string> = {
  'JUST BURGER': 'Just Burger',
  'AUTOPLANET': 'Autoplanet',
  'DECATHLON': 'Decathlon',
  'UNITY': 'Unity',
  'TARRAGONA': 'Tarragona',
  'PANDORA': 'Pandora (JLL)',
  'JLL': 'Alcon Laboratorios Chile (JLL)',
}

const FINANCIAL_MAP: Record<string, FinancialStage> = {
  'sin oc': 'no_po',
  'pendiente facturacion': 'to_invoice',
  'pendiente de pago': 'payment_pending',
  'pendiente pago': 'payment_pending',
  'pagado': 'paid',
}

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}
function money(v: string): number | null {
  if (!v || !v.trim()) return null
  return parseMoneyCLP(v)
}
function isoDate(v: string): string | null {
  if (!v) return null
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? v.trim() : null
}
function parseIsoDate(v: string | null): Date | null {
  if (!v) return null
  return new Date(`${v}T12:00:00.000Z`)
}

async function main() {
  console.log(APPLY ? '=== FASE 2 — MODO APPLY ===' : '=== FASE 2 — MODO DRY-RUN ===')

  const tenantRow = await prisma.tenant.findUnique({ where: { slug: 'ingegar' } })
  if (!tenantRow) throw new Error('Tenant "ingegar" no existe')
  const tenant = tenantRow

  const raw = readFileSync(CSV_PATH, 'utf8')
  const rows = parseCSV(raw)
  const header = rows[0]
  const idx = (name: string) => header.indexOf(name)
  const data = rows.slice(1).filter((r) => r.length === header.length && r.some((c) => c.trim()))
  console.log(`Filas CSV: ${data.length}`)

  const col = {
    sourceRef: idx('source_ref'), cliente: idx('cliente'), centroCosto: idx('centro_costo'),
    nroTrabajo: idx('nro_trabajo'), itDeclarado: idx('it_declarado'), presupuesto: idx('presupuesto'),
    sucursal: idx('sucursal'), descripcion: idx('descripcion'), fechaEjecucion: idx('fecha_ejecucion'),
    tipoTrabajo: idx('tipo_trabajo'), estadoFinanciero: idx('estado_financiero'),
    montoNeto: idx('monto_neto'), iva: idx('iva'), total: idx('total'),
    oc: idx('oc'), fechaOc: idx('fecha_oc'), factura: idx('factura'), fechaFactura: idx('fecha_factura'),
    metodoPago: idx('metodo_pago'), fechaPago: idx('fecha_pago'),
  }

  // Cache de clientes/branches resueltos.
  const clientCache = new Map<string, { id: string; name: string }>()
  for (const csvName of Object.keys(CLIENT_MAP)) {
    const c = await prisma.client.findFirst({ where: { tenantId: tenant.id, name: CLIENT_MAP[csvName] } })
    if (c) clientCache.set(csvName, c)
  }
  console.log('\n--- CLIENTES ---')
  for (const [csvName, c] of clientCache) console.log(`✓ ${csvName} -> ${c.name} (${c.id})`)
  const unmappedClients = new Set(data.map((r) => r[col.cliente]).filter((c) => !clientCache.has(c)))
  if (unmappedClients.size) console.log('⚠ Clientes sin mapeo:', [...unmappedClients])

  const branchCache = new Map<string, { id: string; name: string; netAmount?: never }>()
  async function getBranchId(clientId: string, rawName: string | null): Promise<string> {
    const name = normalizeBranchName(rawName) ?? 'Sin sucursal'
    const key = `${clientId}::${name}`
    const cached = branchCache.get(key)
    if (cached) return cached.id
    const b = await prisma.branch.upsert({
      where: { clientId_name: { clientId, name } },
      update: {},
      create: { tenantId: tenant.id, clientId, name },
    })
    branchCache.set(key, b)
    return b.id
  }

  // Jobs existentes por cliente relevante, para matching por contenido.
  const relevantClientIds = [...clientCache.values()].map((c) => c.id)
  const existingJobs = await prisma.job.findMany({
    where: { tenantId: tenant.id, clientId: { in: relevantClientIds } },
    select: { id: true, importRef: true, costCenter: true, invoiceNumber: true, clientId: true, netAmount: true, executionDate: true, code: true, branch: { select: { name: true } }, client: { select: { name: true } } },
  })
  const byImportRef = new Map(existingJobs.filter((j) => j.importRef).map((j) => [j.importRef!, j]))
  const byCostCenter = new Map<string, typeof existingJobs>()
  const byInvoice = new Map<string, typeof existingJobs>()
  for (const j of existingJobs) {
    if (j.costCenter) (byCostCenter.get(`${j.clientId}::${j.costCenter}`) ?? byCostCenter.set(`${j.clientId}::${j.costCenter}`, []).get(`${j.clientId}::${j.costCenter}`)!).push(j)
    if (j.invoiceNumber?.trim()) (byInvoice.get(`${j.clientId}::${j.invoiceNumber.trim()}`) ?? byInvoice.set(`${j.clientId}::${j.invoiceNumber.trim()}`, []).get(`${j.clientId}::${j.invoiceNumber.trim()}`)!).push(j)
  }

  type Report = { source_ref: string; cliente: string; match_status: string; confidence: string; action: string; fields_changed: string }
  const report: Report[] = []
  const seqCache = new Map<string, number>()
  let matched = 0, created = 0, ambiguous = 0, skipped = 0

  for (const r of data) {
    const sourceRef = r[col.sourceRef]
    const csvClient = r[col.cliente]
    const client = clientCache.get(csvClient)
    if (!client) { skipped++; report.push({ source_ref: sourceRef, cliente: csvClient, match_status: 'SKIP', confidence: 'NONE', action: 'sin-cliente-mapeado', fields_changed: '' }); continue }

    // "SIN CENTRO DE COSTO" es un placeholder literal (ver Fase 2 de la
    // reconciliación anterior, mismo hallazgo) — decenas de trabajos distintos
    // comparten ese texto, así que NO es una clave de match válida.
    const costCenterRaw = r[col.centroCosto]?.trim() || null
    const costCenter = costCenterRaw && !/^sin centro de costo$/i.test(costCenterRaw) ? costCenterRaw : null
    const invoiceNumber = r[col.factura]?.trim() || null
    const branchRaw = r[col.sucursal]?.trim() || null
    const execDate = isoDate(r[col.fechaEjecucion])
    const netAmount = money(r[col.montoNeto])

    // Cascada de niveles: un nivel con múltiples candidatos NO es un
    // veredicto final de "ambiguo" — un nivel siguiente más específico puede
    // desambiguar igual (ej. "JB-PR-ABRIL" es una etiqueta de lote mensual
    // compartida por 9 trabajos distintos; la fecha+sucursal+monto sí los
    // distingue). Solo se reporta AMBIGUOUS si NINGÚN nivel llega a 1.
    let match: (typeof existingJobs)[number] | undefined
    let anyTierHadMultiple = false
    const tierNotes: string[] = []

    // Nivel 0: re-corrida de este mismo script — el Job ya quedó con
    // importRef = source_ref de una aplicación anterior.
    if (!match) match = byImportRef.get(sourceRef)

    if (!match && costCenter) {
      const candidates = byCostCenter.get(`${client.id}::${costCenter}`) ?? []
      if (candidates.length === 1) match = candidates[0]
      else if (candidates.length > 1) { anyTierHadMultiple = true; tierNotes.push(`centro_costo "${costCenter}" matchea ${candidates.length} jobs`) }
    }
    if (!match && invoiceNumber) {
      const candidates = byInvoice.get(`${client.id}::${invoiceNumber}`) ?? []
      if (candidates.length === 1) match = candidates[0]
      else if (candidates.length > 1) { anyTierHadMultiple = true; tierNotes.push(`factura "${invoiceNumber}" matchea ${candidates.length} jobs`) }
    }
    if (!match && branchRaw && execDate && netAmount != null) {
      const branchNorm = normalizeBranchName(branchRaw)
      const fuzzy = existingJobs.filter((e) =>
        e.clientId === client.id &&
        normalizeBranchName(e.branch?.name) === branchNorm &&
        e.netAmount === netAmount &&
        e.executionDate && new Date(e.executionDate).toISOString().slice(0, 10) === execDate,
      )
      if (fuzzy.length === 1) match = fuzzy[0]
      else if (fuzzy.length > 1) { anyTierHadMultiple = true; tierNotes.push(`fuzzy (sucursal+fecha+monto) matchea ${fuzzy.length} jobs`) }
    }
    // Último desempate: cliente+fecha+monto exacto, sin exigir sucursal
    // (cubre filas con sucursal vacía, ej. Autoplanet, y desambigua algunos
    // de los casos "centro_costo"/"factura" compartidos entre varios jobs).
    if (!match && execDate && netAmount != null) {
      const byDateAmount = existingJobs.filter((e) => e.clientId === client.id && e.netAmount === netAmount && e.executionDate && new Date(e.executionDate).toISOString().slice(0, 10) === execDate)
      if (byDateAmount.length === 1) { match = byDateAmount[0]; anyTierHadMultiple = false }
      else if (byDateAmount.length > 1) anyTierHadMultiple = true
    }

    if (!match && anyTierHadMultiple) {
      ambiguous++
      report.push({ source_ref: sourceRef, cliente: csvClient, match_status: 'AMBIGUOUS', confidence: 'NONE', action: tierNotes.join(' | '), fields_changed: '' })
      continue
    }

    const type = normalizeType(r[col.tipoTrabajo])
    const financialStage = FINANCIAL_MAP[norm(r[col.estadoFinanciero])]
    const nonBillable = norm(r[col.estadoFinanciero]) === 'sin costo'
    const docReport = norm(r[col.itDeclarado]) === 'si' ? true : undefined

    if (match) {
      const changed: string[] = []
      const setData: Record<string, unknown> = {}
      const maybe = (field: string, val: unknown, current: unknown) => {
        if (val == null || val === '') return
        if (val === current) return
        setData[field] = val; changed.push(field)
      }
      maybe('costCenter', costCenter, match.costCenter)
      maybe('jobNumber', r[col.nroTrabajo] ? Number(r[col.nroTrabajo]) : null, undefined)
      maybe('quoteRef', r[col.presupuesto]?.trim() || null, undefined)
      maybe('netAmount', netAmount, match.netAmount)
      maybe('taxAmount', money(r[col.iva]), undefined)
      maybe('purchaseOrder', r[col.oc]?.trim() || null, undefined)
      maybe('purchaseOrderDate', parseIsoDate(isoDate(r[col.fechaOc])), undefined)
      maybe('invoiceNumber', invoiceNumber, match.invoiceNumber)
      maybe('invoiceDate', parseIsoDate(isoDate(r[col.fechaFactura])), undefined)
      maybe('creditDays', parseCreditDays(r[col.metodoPago]), undefined)
      maybe('paymentDate', parseIsoDate(isoDate(r[col.fechaPago])), undefined)
      if (financialStage) setData.financialStage = financialStage
      if (nonBillable) setData.nonBillable = true
      if (docReport) setData.docReport = true
      if (!match.code) setData.code = await generateJobCode(clientCodeFrom(client.name), JOB_TYPE_CODE[type] ?? 'OT', execDate, seqCache)

      if (Object.keys(setData).length > 0) {
        matched++
        report.push({ source_ref: sourceRef, cliente: csvClient, match_status: 'MATCHED', confidence: 'HIGH', action: APPLY ? 'update' : 'would-update', fields_changed: changed.join('|') })
        if (APPLY) {
          const finStage = setData.financialStage as FinancialStage | undefined
          await prisma.job.update({
            where: { id: match.id },
            data: {
              ...setData,
              ...(finStage ? { collectionStatus: deriveCollectionStatus(finStage) } : {}),
              status: deriveJobStatus('executed', nonBillable),
            },
          })
        }
      } else {
        report.push({ source_ref: sourceRef, cliente: csvClient, match_status: 'MATCHED', confidence: 'HIGH', action: 'no-change', fields_changed: '' })
      }
    } else {
      if (!execDate && netAmount == null) { ambiguous++; report.push({ source_ref: sourceRef, cliente: csvClient, match_status: 'AMBIGUOUS', confidence: 'NONE', action: 'sin fecha ni monto — insuficiente para crear', fields_changed: '' }); continue }
      created++
      report.push({ source_ref: sourceRef, cliente: csvClient, match_status: 'NEW', confidence: 'HIGH', action: APPLY ? 'create' : 'would-create', fields_changed: '' })
      if (APPLY) {
        const branchId = await getBranchId(client.id, branchRaw)
        const code = await generateJobCode(clientCodeFrom(client.name), JOB_TYPE_CODE[type] ?? 'OT', execDate, seqCache)
        const finStage = financialStage ?? 'no_po'
        await prisma.job.create({
          data: {
            tenantId: tenant.id, clientId: client.id, branchId,
            description: r[col.descripcion]?.trim() || '(sin descripción)',
            type, code, importRef: sourceRef,
            costCenter, jobNumber: r[col.nroTrabajo] ? Number(r[col.nroTrabajo]) : null,
            quoteRef: r[col.presupuesto]?.trim() || null,
            executionDate: parseIsoDate(execDate),
            netAmount, taxAmount: money(r[col.iva]),
            purchaseOrder: r[col.oc]?.trim() || null,
            purchaseOrderDate: parseIsoDate(isoDate(r[col.fechaOc])),
            invoiceNumber, invoiceDate: parseIsoDate(isoDate(r[col.fechaFactura])),
            creditDays: parseCreditDays(r[col.metodoPago]),
            paymentDate: parseIsoDate(isoDate(r[col.fechaPago])),
            financialStage: finStage,
            operationalStage: 'executed',
            nonBillable,
            docReport: docReport ?? null,
            status: deriveJobStatus('executed', nonBillable),
            collectionStatus: deriveCollectionStatus(finStage),
          },
        })
      }
    }
  }

  writeFileSync('backups/reconciliation-phase2-report.csv',
    'source_ref,cliente,match_status,confidence,action,fields_changed\n' +
    report.map((r) => [r.source_ref, r.cliente, r.match_status, r.confidence, r.action, r.fields_changed].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'))

  console.log('\n--- RESUMEN FASE 2 ---')
  console.log(`Filas CSV: ${data.length}`)
  console.log(`Matched (con cambios): ${matched}`)
  console.log(`Nuevos: ${created}`)
  console.log(`Ambiguos: ${ambiguous}`)
  console.log(`Sin cliente mapeado: ${skipped}`)
  console.log('\nReporte: backups/reconciliation-phase2-report.csv')
  if (!APPLY) console.log('\n(dry-run — nada se escribió.)')

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
