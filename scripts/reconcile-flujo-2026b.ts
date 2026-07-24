/**
 * Reconciliación e importación del archivo de referencia "INGEGAR Control"
 * (286 trabajos reales) contra los Job ya existentes en la base.
 * Ver docs/superpowers/specs/2026-07-24-flujo-caja-reconciliation-design.md
 * para el algoritmo completo y el razonamiento.
 *
 * Modo por defecto: --dry-run (solo lee, no escribe nada). Se necesita
 * --apply explícito para escribir, y solo después de revisar el reporte.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/reconcile-flujo-2026b.ts
 *      npx tsx --env-file=.env.production.local scripts/reconcile-flujo-2026b.ts --apply
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'
import { normalizeBranchName, normalizeType } from '../src/lib/cashflow/normalize.js'
import { deriveJobStatus, deriveCollectionStatus } from '../src/lib/cashflow/derive-legacy-status.js'
import type {
  ProcessFlow, CommercialStage, OperationalStage, DocumentationStage, FinancialStage,
} from '../src/generated/prisma/enums.js'

async function withRetry<T>(fn: () => Promise<T>, retries = 6, delayMs = 800): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn() }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('SQLITE_CONSTRAINT')) throw e // determinístico — reintentar no cambia el resultado
      if (i < retries - 1) {
        console.warn(`  [retry ${i + 1}/${retries - 1}] ${msg}`)
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)))
        continue
      }
      throw e
    }
  }
  throw new Error('Max retries exceeded')
}

const HTML_PATH = 'flujo de caja produccion/INGEGAR_Control_IngegarONE_UI_Acordeon_2026 (1).html'
const TENANT_SLUG = 'ingegar'
const APPLY = process.argv.includes('--apply')

type SourceJob = {
  id: string
  jobNumber?: string
  client: string
  branch: string
  description: string
  workflowType: string
  requestDate: string
  visitDate?: string
  executionDate: string
  technician?: string
  commercialStage?: string
  operationalStage?: string
  documentationStage?: string
  financialStage?: string
  quoteNumber?: string
  quoteSentDate?: string
  approvalDate?: string
  rejectionDate?: string
  rejectionReason?: string
  poNumber?: string
  poDate?: string
  invoiceNumber?: string
  invoiceDate?: string
  paymentTermsDays?: number
  dueDate?: string
  paymentDate?: string
  amountNet?: number
  vat?: number
  amountTotal?: number
  notes?: string
  documents?: { ot: boolean | null; photos: boolean | null; report: boolean | null; clientSent: boolean | null }
  followUp?: { lastContactDate: string; nextContactDate: string; contactNote: string }
  processFlow?: string
  nonBillable?: boolean
  nonBillableReason?: string
  source?: { file: string; sheet: string; row: number }
}

// Cliente del archivo -> nombre canónico en la app + código de 3 letras para `code`.
const CLIENT_MAP: Record<string, { name: string; code: string; importPrefix: string }> = {
  'JUST BURGER': { name: 'Just Burger', code: 'JBU', importPrefix: 'JB' },
  'DECATHLON':   { name: 'Decathlon',   code: 'DEC', importPrefix: 'DC' },
  'UNITY':       { name: 'Unity',       code: 'UTY', importPrefix: 'UTY' },
  'TARRAGONA':   { name: 'Tarragona',   code: 'TAR', importPrefix: null as unknown as string },
  // Confirmado con el dueño (2026-07-24): "Pandora"/"JLL" del archivo son las
  // mismas cuentas ya existentes, no clientes nuevos — se mapean por nombre exacto.
  'PANDORA':     { name: 'Pandora (JLL)', code: 'PAN', importPrefix: null as unknown as string },
  'JLL':         { name: 'Alcon Laboratorios Chile (JLL)', code: 'JLL', importPrefix: null as unknown as string },
}

const TYPE_CODE: Record<string, string> = { requerimiento: 'RQ', emergencia: 'EM', preventivo: 'PR', proyecto: 'PY', otro: 'OT' }

// Registros con datos rotos que NO se auto-procesan — ver spec, sección "Requiere revisión manual".
const BROKEN_IDS = new Set(['IMP-PAN-0007', '260528-DC-RQ-02', 'SIN CENTRO DE COSTO-25'])

function loadSourceJobs(): SourceJob[] {
  const html = readFileSync(HTML_PATH, 'utf8')
  const m = html.match(/const DEFAULT_DATA=(\[.*?\]);/s)
  if (!m) throw new Error('No se encontró DEFAULT_DATA en el HTML de referencia')
  return JSON.parse(m[1])
}

const PROCESS_FLOWS: ProcessFlow[] = ['pre_quote', 'post_execution']
const COMMERCIAL_STAGES: CommercialStage[] = ['intake', 'quote_draft', 'quote_sent', 'valuation_pending', 'approved', 'rejected']
const OPERATIONAL_STAGES: OperationalStage[] = ['pending', 'scheduled', 'in_progress', 'executed', 'client_review', 'closed']
const DOCUMENTATION_STAGES: DocumentationStage[] = ['pending', 'partial', 'ready', 'sent']
const FINANCIAL_STAGES: FinancialStage[] = ['no_po', 'po_requested', 'po_received', 'to_invoice', 'invoiced', 'payment_pending', 'overdue', 'paid']

function safeEnum<T extends string>(allowed: T[], value: string | undefined, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function parseIsoDate(v: string | undefined | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return new Date(`${v}T12:00:00.000Z`) // mediodía UTC — evita el corrimiento de día de medianoche
}

const codeSeqCache = new Map<string, number>()
async function generateCode(clientCode: string, typeCode: string, dateStr: string | null): Promise<string> {
  if (!dateStr) {
    const prefix = `IMP-${clientCode}-`
    let seq = codeSeqCache.get(prefix)
    if (seq == null) {
      const existing = await prisma.job.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } })
      seq = existing.reduce((max, e) => Math.max(max, Number(e.code!.slice(prefix.length)) || 0), 0)
    }
    seq += 1
    codeSeqCache.set(prefix, seq)
    return `${prefix}${String(seq).padStart(4, '0')}`
  }
  const yymmdd = dateStr.slice(2).replace(/-/g, '')
  const prefix = `${yymmdd}-${clientCode}-${typeCode}-`
  let seq = codeSeqCache.get(prefix)
  if (seq == null) {
    const existing = await prisma.job.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } })
    seq = existing.reduce((max, e) => Math.max(max, Number(e.code!.slice(prefix.length)) || 0), 0)
  }
  seq += 1
  codeSeqCache.set(prefix, seq)
  return `${prefix}${String(seq).padStart(2, '0')}`
}

function normalizedClientName(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+(SPA|LTDA|S\.A\.|CHILE)\.?$/g, '').replace(/\s+/g, ' ')
}

async function findDuplicateClient(tenantId: string, candidateName: string) {
  const target = normalizedClientName(candidateName)
  const all = await prisma.client.findMany({ where: { tenantId }, select: { id: true, name: true } })
  return all.find((c) => normalizedClientName(c.name) === target || normalizedClientName(c.name).includes(target) || target.includes(normalizedClientName(c.name)))
}

async function main() {
  console.log(APPLY ? '=== MODO APPLY (va a escribir) ===' : '=== MODO DRY-RUN (solo lectura) ===')

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" no existe`)

  const source = loadSourceJobs()
  console.log(`\nRegistros en el archivo: ${source.length}`)

  const byClient: Record<string, number> = {}
  source.forEach((j) => { byClient[j.client] = (byClient[j.client] || 0) + 1 })
  console.log('Por cliente:', byClient)

  // Clientes nuevos: chequeo de duplicado antes de nada.
  console.log('\n--- CLIENTES ---')
  const clientIdMap: Record<string, string | null> = {}
  const clientsNeedingReview: string[] = []
  for (const rawName of Object.keys(byClient)) {
    const mapped = CLIENT_MAP[rawName]
    if (!mapped) { console.log(`⚠ Cliente sin mapeo conocido: "${rawName}" — se omite`); continue }
    const existing = await prisma.client.findFirst({ where: { tenantId: tenant.id, name: mapped.name } })
    if (existing) {
      clientIdMap[rawName] = existing.id
      console.log(`✓ ${mapped.name} ya existe (${existing.id})`)
      continue
    }
    const dup = await findDuplicateClient(tenant.id, mapped.name)
    if (dup) {
      console.log(`⚠ Posible duplicado para "${mapped.name}": ya existe "${dup.name}" (${dup.id}) — REQUIERE REVISIÓN MANUAL, no se crea`)
      clientsNeedingReview.push(rawName)
      clientIdMap[rawName] = null
      continue
    }
    console.log(`+ Cliente nuevo a crear: ${mapped.name}`)
    clientIdMap[rawName] = 'PENDING_CREATE'
  }

  // Trabajos existentes de los clientes involucrados, para matching.
  const relevantClientIds = Object.values(clientIdMap).filter((id): id is string => !!id && id !== 'PENDING_CREATE')
  const existingJobs = await prisma.job.findMany({
    where: { tenantId: tenant.id, OR: [{ clientId: { in: relevantClientIds } }, { importRef: { not: null } }] },
    select: { id: true, importRef: true, invoiceNumber: true, quoteRef: true, clientId: true, netAmount: true, executionDate: true, branch: { select: { name: true } }, client: { select: { name: true } } },
  })
  console.log(`\nTrabajos existentes relevantes en la base: ${existingJobs.length}`)

  const byImportRef = new Map(existingJobs.filter((j) => j.importRef).map((j) => [j.importRef!, j]))
  const byInvoice = new Map<string, typeof existingJobs>()
  const byQuote = new Map<string, typeof existingJobs>()
  for (const j of existingJobs) {
    const inv = j.invoiceNumber?.trim()
    if (inv) (byInvoice.get(inv) ?? byInvoice.set(inv, []).get(inv)!).push(j)
  }

  let exactImportRefMatches = 0, invoiceMatches = 0, fuzzyMatches = 0, noMatch = 0, broken = 0, ambiguous = 0
  const inserts: SourceJob[] = []
  const reviewList: string[] = []

  for (const j of source) {
    if (BROKEN_IDS.has(j.id)) { broken++; reviewList.push(`${j.id} (${j.client}): dato roto conocido, ver spec`); continue }

    const mapped = CLIENT_MAP[j.client]
    if (!mapped) continue

    let match: (typeof existingJobs)[number] | undefined

    if (mapped.importPrefix && j.source?.sheet && j.source?.row != null) {
      const candidateRef = `${mapped.importPrefix}#${j.source.sheet}#${j.source.row}`
      const hit = byImportRef.get(candidateRef)
      if (hit) {
        const branchOk = !hit.branch?.name || normalizeBranchName(hit.branch.name) === normalizeBranchName(j.branch)
        const amountOk = !hit.netAmount || hit.netAmount === (j.amountNet ?? null)
        if (branchOk && amountOk) { match = hit; exactImportRefMatches++ }
      }
    }

    if (!match && j.invoiceNumber?.trim()) {
      const candidates = byInvoice.get(j.invoiceNumber.trim()) ?? []
      if (candidates.length === 1) { match = candidates[0]; invoiceMatches++ }
      else if (candidates.length > 1) { ambiguous++; reviewList.push(`${j.id}: factura ${j.invoiceNumber} matchea ${candidates.length} trabajos existentes`); continue }
    }

    if (!match) {
      const fuzzy = existingJobs.filter((e) =>
        e.client.name === mapped.name &&
        normalizeBranchName(e.branch?.name) === normalizeBranchName(j.branch) &&
        e.netAmount === (j.amountNet ?? null) &&
        e.executionDate && j.executionDate &&
        new Date(e.executionDate).toISOString().slice(0, 10) === j.executionDate,
      )
      if (fuzzy.length === 1) { match = fuzzy[0]; fuzzyMatches++ }
      else if (fuzzy.length > 1) { ambiguous++; reviewList.push(`${j.id}: match fuzzy ambiguo (${fuzzy.length} candidatos)`); continue }
    }

    if (match) {
      if (APPLY) await applyUpdate(match.id, j)
    } else {
      noMatch++
      inserts.push(j)
      if (APPLY) await applyInsert(tenant.id, clientIdMap, mapped, j)
    }
  }

  console.log('\n--- RESUMEN ---')
  console.log(`Matches por importRef reconstruido (validado): ${exactImportRefMatches}`)
  console.log(`Matches por N° de factura:                     ${invoiceMatches}`)
  console.log(`Matches fuzzy (cliente+sucursal+fecha+monto):  ${fuzzyMatches}`)
  console.log(`Sin match -> trabajos nuevos a crear:          ${noMatch}`)
  console.log(`Ambiguos (requieren revisión):                 ${ambiguous}`)
  console.log(`Rotos (requieren revisión):                    ${broken}`)
  console.log(`\nTotal procesado: ${exactImportRefMatches + invoiceMatches + fuzzyMatches + noMatch + ambiguous + broken} / ${source.length}`)

  if (clientsNeedingReview.length) console.log('\nClientes con posible duplicado (no creados):', clientsNeedingReview)

  if (reviewList.length) {
    console.log('\n--- REQUIERE REVISIÓN MANUAL ---')
    reviewList.forEach((r) => console.log(' -', r))
  }

  if (!APPLY) console.log('\n(dry-run — nada se escribió. Correr con --apply para aplicar los matches limpios.)')
  await prisma.$disconnect()
}

async function applyUpdate(jobId: string, j: SourceJob) {
  const existing = await prisma.job.findUniqueOrThrow({ where: { id: jobId } })

  const operationalStage = safeEnum(OPERATIONAL_STAGES, j.operationalStage, 'executed')
  const financialStage = safeEnum(FINANCIAL_STAGES, j.financialStage, 'no_po')
  const commercialStage = safeEnum(COMMERCIAL_STAGES, j.commercialStage, 'approved')
  const documentationStage = safeEnum(DOCUMENTATION_STAGES, j.documentationStage, 'pending')
  const processFlow = safeEnum(PROCESS_FLOWS, j.processFlow, 'pre_quote')
  const nonBillable = !!j.nonBillable

  const type = normalizeType(j.workflowType)
  const code = existing.code ?? (await generateCode(CLIENT_MAP[j.client].code, TYPE_CODE[type], j.requestDate || j.executionDate || null))

  await withRetry(() => prisma.job.update({
    where: { id: jobId },
    data: {
      // Campos clásicos: solo se completan si estaban vacíos — nunca se pisa un valor ya cargado.
      netAmount: existing.netAmount ?? j.amountNet ?? undefined,
      taxAmount: existing.taxAmount ?? j.vat ?? undefined,
      invoiceNumber: existing.invoiceNumber ?? j.invoiceNumber ?? undefined,
      invoiceDate: existing.invoiceDate ?? parseIsoDate(j.invoiceDate) ?? undefined,
      purchaseOrder: existing.purchaseOrder ?? j.poNumber ?? undefined,
      purchaseOrderDate: existing.purchaseOrderDate ?? parseIsoDate(j.poDate) ?? undefined,
      creditDays: existing.creditDays ?? j.paymentTermsDays ?? undefined,
      paymentDate: existing.paymentDate ?? parseIsoDate(j.paymentDate) ?? undefined,
      quoteRef: existing.quoteRef ?? j.quoteNumber ?? undefined,
      // Campos nuevos del sub-proyecto 1: siempre se completan, no había nada que pisar.
      code,
      processFlow, commercialStage, operationalStage, documentationStage, financialStage,
      docOt: j.documents?.ot ?? undefined,
      docPhotos: j.documents?.photos ?? undefined,
      docReport: j.documents?.report ?? undefined,
      docClientSent: j.documents?.clientSent ?? undefined,
      rejectionReason: j.rejectionReason || undefined,
      rejectionDate: parseIsoDate(j.rejectionDate) ?? undefined,
      nonBillable,
      nonBillableReason: j.nonBillableReason || undefined,
      lastContactDate: parseIsoDate(j.followUp?.lastContactDate) ?? undefined,
      nextContactDate: parseIsoDate(j.followUp?.nextContactDate) ?? undefined,
      contactNote: j.followUp?.contactNote || undefined,
      status: deriveJobStatus(operationalStage, nonBillable),
      collectionStatus: deriveCollectionStatus(financialStage),
    },
  }))
}

const branchCache = new Map<string, string>()
async function getBranchId(tenantId: string, clientId: string, name: string): Promise<string> {
  const cacheKey = `${clientId}::${name}`
  if (branchCache.has(cacheKey)) return branchCache.get(cacheKey)!
  const b = await withRetry(() => prisma.branch.upsert({
    where: { clientId_name: { clientId, name } },
    update: {},
    create: { tenantId, clientId, name },
  }))
  branchCache.set(cacheKey, b.id)
  return b.id
}

async function applyInsert(tenantId: string, clientIdMap: Record<string, string | null>, mapped: { name: string; code: string }, j: SourceJob) {
  const clientId = clientIdMap[j.client]
  if (!clientId || clientId === 'PENDING_CREATE') {
    console.warn(`  ⚠ Omitido ${j.id}: cliente "${j.client}" sin id resuelto (revisar duplicado o creación pendiente)`)
    return
  }
  // Prefijo por cliente obligatorio: "Hoja1"/fila 2 se repite entre los Excel
  // de distintos clientes chicos (cada uno arranca su propia hoja en fila 2) —
  // sin el código de cliente, dos clientes distintos generan el mismo importRef.
  const importRef = j.source?.sheet && j.source?.row != null
    ? `FLUJO2026B-${mapped.code}#${j.source.sheet}#${j.source.row}`
    : `FLUJO2026B-${mapped.code}#${j.id}`

  // Idempotencia: si ya existe un Job con este importRef (re-run tras un corte
  // a mitad, o corrida repetida), se completa en vez de intentar crear otro.
  const already = await prisma.job.findUnique({ where: { importRef }, select: { id: true } })
  if (already) { await applyUpdate(already.id, j); return }

  const branchName = normalizeBranchName(j.branch) ?? 'Sin sucursal'
  const branchId = await getBranchId(tenantId, clientId, branchName)

  const operationalStage = safeEnum(OPERATIONAL_STAGES, j.operationalStage, 'executed')
  const financialStage = safeEnum(FINANCIAL_STAGES, j.financialStage, 'no_po')
  const commercialStage = safeEnum(COMMERCIAL_STAGES, j.commercialStage, 'approved')
  const documentationStage = safeEnum(DOCUMENTATION_STAGES, j.documentationStage, 'pending')
  const processFlow = safeEnum(PROCESS_FLOWS, j.processFlow, 'pre_quote')
  const nonBillable = !!j.nonBillable
  const type = normalizeType(j.workflowType)
  const code = await generateCode(mapped.code, TYPE_CODE[type], j.requestDate || j.executionDate || null)

  await withRetry(() => prisma.job.create({
    data: {
      tenantId, clientId, branchId,
      description: j.description || '(sin descripción)',
      type,
      executionDate: parseIsoDate(j.executionDate),
      netAmount: j.amountNet ?? null,
      taxAmount: j.vat ?? null,
      invoiceNumber: j.invoiceNumber || null,
      invoiceDate: parseIsoDate(j.invoiceDate),
      purchaseOrder: j.poNumber || null,
      purchaseOrderDate: parseIsoDate(j.poDate),
      creditDays: j.paymentTermsDays ?? null,
      paymentDate: parseIsoDate(j.paymentDate),
      quoteRef: j.quoteNumber || null,
      importRef,
      code,
      processFlow, commercialStage, operationalStage, documentationStage, financialStage,
      docOt: j.documents?.ot ?? null,
      docPhotos: j.documents?.photos ?? null,
      docReport: j.documents?.report ?? null,
      docClientSent: j.documents?.clientSent ?? null,
      rejectionReason: j.rejectionReason || null,
      rejectionDate: parseIsoDate(j.rejectionDate),
      nonBillable,
      nonBillableReason: j.nonBillableReason || null,
      lastContactDate: parseIsoDate(j.followUp?.lastContactDate),
      nextContactDate: parseIsoDate(j.followUp?.nextContactDate),
      contactNote: j.followUp?.contactNote || null,
      status: deriveJobStatus(operationalStage, nonBillable),
      collectionStatus: deriveCollectionStatus(financialStage),
    },
  }))
}

main().catch((e) => { console.error(e); process.exit(1) })
