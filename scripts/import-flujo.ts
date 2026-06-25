import { writeFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { prisma } from '../src/lib/prisma.js'
import {
  parseMoneyCLP,
  parseCreditDays,
  normalizeType,
  normalizeCollectionStatus,
  normalizeBranchName,
} from '../src/lib/cashflow/normalize.js'

async function withRetry<T>(fn: () => Promise<T>, retries = 6, delayMs = 800): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn() }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('SQLITE_BUSY') && i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)))
        continue
      }
      throw e
    }
  }
  throw new Error('Max retries exceeded')
}

const TENANT_SLUG = 'ingegar'

const SOURCES = [
  {
    file: 'design-reference/Flujo de Caja Just Burger General 2026.xlsx',
    clientName: 'Just Burger',
    prefix: 'JB',
  },
  {
    file: 'design-reference/FLUJO DE CAJA DECATHLON GENERAL 20262.xlsx',
    clientName: 'Decathlon',
    prefix: 'DC',
  },
  {
    file: 'design-reference/FLUJO DE CAJA GENERAL UNITY 2026.xlsx',
    clientName: 'Unity',
    prefix: 'UTY',
  },
]

const cell = (row: ExcelJS.Row, i: number): unknown => {
  const v = (row.values as unknown[])[i]
  if (v == null) return null
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: unknown }
    return o.result ?? o.text ?? null
  }
  return v
}
const asDate = (v: unknown): Date | null => (v instanceof Date ? v : null)
const str = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

async function importClient(
  tenantId: string,
  source: (typeof SOURCES)[0],
  csvRows: string[],
): Promise<{ count: number; net: number }> {
  let client = await prisma.client.findFirst({
    where: { tenantId, name: source.clientName },
  })
  if (!client) {
    client = await prisma.client.create({
      data: { tenantId, name: source.clientName },
    })
    console.log(`  Creado cliente: ${source.clientName}`)
  }

  const branchCache = new Map<string, string>()
  async function getBranchId(name: string): Promise<string> {
    if (branchCache.has(name)) return branchCache.get(name)!
    const b = await withRetry(() => prisma.branch.upsert({
      where: { clientId_name: { clientId: client!.id, name } },
      update: {},
      create: { tenantId, clientId: client!.id, name },
    }))
    branchCache.set(name, b.id)
    return b.id
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(source.file)

  let count = 0
  let netSum = 0

  for (const ws of wb.worksheets) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const description = str(cell(row, 6))
      const rawBranch = cell(row, 5)
      const netAmount = parseMoneyCLP(cell(row, 16))
      if (!description && netAmount == null) continue

      const branchName = normalizeBranchName(rawBranch) ?? 'Sin sucursal'
      const bId = await getBranchId(branchName)
      const importRef = `${source.prefix}#${ws.name}#${r}`
      const taxAmount = parseMoneyCLP(cell(row, 17))
      const collectionStatus = normalizeCollectionStatus(cell(row, 24))
      const invoiceDate = asDate(cell(row, 22))

      const data = {
        tenantId,
        clientId: client!.id,
        branchId: bId,
        costCenter: str(cell(row, 1)),
        jobNumber:
          typeof cell(row, 2) === 'number' ? Math.round(cell(row, 2) as number) : null,
        quoteRef: str(cell(row, 4)),
        hasTechReport:
          String(cell(row, 3) ?? '')
            .trim()
            .toUpperCase() === 'SI',
        description: description ?? '(sin descripción)',
        type: normalizeType(cell(row, 13)),
        status: 'ejecutado' as const,
        executionDate: asDate(cell(row, 9)),
        notes: str(cell(row, 12)),
        extraNotes: str(cell(row, 15)),
        netAmount,
        taxAmount:
          taxAmount ?? (netAmount != null ? Math.round(netAmount * 0.19) : null),
        purchaseOrder: str(cell(row, 19)),
        purchaseOrderDate: asDate(cell(row, 20)),
        invoiceNumber: str(cell(row, 21)),
        invoiceDate,
        creditDays: parseCreditDays(cell(row, 23)),
        paymentMethodRaw: str(cell(row, 23)),
        collectionStatus,
        paymentDate: asDate(cell(row, 25)),
      }

      await withRetry(() => prisma.job.upsert({
        where: { importRef },
        update: data,
        create: { ...data, importRef },
      }))
      count++
      netSum += netAmount ?? 0

      csvRows.push(
        [
          importRef,
          branchName,
          data.type,
          JSON.stringify(description ?? ''),
          data.executionDate?.toISOString().slice(0, 10) ?? '',
          netAmount ?? '',
          data.taxAmount ?? '',
          collectionStatus,
          data.invoiceNumber ?? '',
          invoiceDate?.toISOString().slice(0, 10) ?? '',
          data.creditDays ?? '',
        ].join(','),
      )
    }
  }

  console.log(
    `  ${source.clientName}: ${count} trabajos, ${branchCache.size} sucursales, neto $${netSum.toLocaleString('es-CL')}`,
  )
  return { count, net: netSum }
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant "${TENANT_SLUG}" no existe — corre npm run db:seed`)

  const csvRows = [
    'importRef,branch,type,description,executionDate,netAmount,taxAmount,collectionStatus,invoiceNumber,invoiceDate,creditDays',
  ]

  let totalCount = 0
  let totalNet = 0

  for (const source of SOURCES) {
    console.log(`\nImportando ${source.clientName}…`)
    const { count, net } = await importClient(tenant.id, source, csvRows)
    totalCount += count
    totalNet += net
  }

  await writeFile('design-reference/flujo-consolidado.csv', csvRows.join('\n'), 'utf8')

  console.log(`\n✓ Total: ${totalCount} trabajos importados.`)
  console.log(`  Neto consolidado: $${totalNet.toLocaleString('es-CL')}`)
  console.log(`  CSV actualizado: design-reference/flujo-consolidado.csv`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
