import { writeFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { prisma } from '../src/lib/prisma'
import {
  parseMoneyCLP,
  parseCreditDays,
  normalizeType,
  normalizeCollectionStatus,
  normalizeBranchName,
} from '../src/lib/cashflow/normalize'

const FILE = 'design-reference/Flujo de Caja Just Burger General 2026.xlsx'
const TENANT_SLUG = 'ingegar' // jobs are owned by the INGEGAR tenant
const CLIENT_NAME = 'Just Burger'

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

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant ${TENANT_SLUG} no existe (corre db:seed)`)

  // Ensure the client exists (tenant-scoped).
  let client = await prisma.client.findFirst({ where: { tenantId: tenant.id, name: CLIENT_NAME } })
  if (!client) {
    client = await prisma.client.create({ data: { tenantId: tenant.id, name: CLIENT_NAME } })
  }

  const branchCache = new Map<string, string>() // name -> id
  async function branchId(name: string): Promise<string> {
    if (branchCache.has(name)) return branchCache.get(name)!
    const b = await prisma.branch.upsert({
      where: { clientId_name: { clientId: client!.id, name } },
      update: {},
      create: { tenantId: tenant!.id, clientId: client!.id, name },
    })
    branchCache.set(name, b.id)
    return b.id
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(FILE)

  const csvRows: string[] = [
    'importRef,branch,type,description,executionDate,netAmount,taxAmount,collectionStatus,invoiceNumber,invoiceDate,creditDays',
  ]
  let count = 0
  let netSum = 0

  for (const ws of wb.worksheets) {
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const description = str(cell(row, 6))
      const rawBranch = cell(row, 5)
      const netAmount = parseMoneyCLP(cell(row, 16))
      if (!description && netAmount == null) continue // empty row

      const branchName = normalizeBranchName(rawBranch) ?? 'Sin sucursal'
      const bId = await branchId(branchName)
      const importRef = `flujo2026#${ws.name}#${r}`
      const taxAmount = parseMoneyCLP(cell(row, 17))
      const collectionStatus = normalizeCollectionStatus(cell(row, 24))
      const invoiceDate = asDate(cell(row, 22))
      const data = {
        tenantId: tenant.id,
        clientId: client.id,
        branchId: bId,
        costCenter: str(cell(row, 1)),
        jobNumber: typeof cell(row, 2) === 'number' ? (cell(row, 2) as number) : null,
        quoteRef: str(cell(row, 4)),
        hasTechReport: String(cell(row, 3) ?? '').trim().toUpperCase() === 'SI',
        description: description ?? '(sin descripción)',
        type: normalizeType(cell(row, 13)),
        status: 'ejecutado' as const,
        executionDate: asDate(cell(row, 9)),
        notes: str(cell(row, 12)),
        extraNotes: str(cell(row, 15)),
        netAmount,
        taxAmount: taxAmount ?? (netAmount != null ? Math.round(netAmount * 0.19) : null),
        purchaseOrder: str(cell(row, 19)),
        purchaseOrderDate: asDate(cell(row, 20)),
        invoiceNumber: str(cell(row, 21)),
        invoiceDate,
        creditDays: parseCreditDays(cell(row, 23)),
        paymentMethodRaw: str(cell(row, 23)),
        collectionStatus,
        paymentDate: asDate(cell(row, 25)),
      }

      await prisma.job.upsert({ where: { importRef }, update: data, create: { ...data, importRef } })
      count++
      netSum += netAmount ?? 0
      csvRows.push(
        [importRef, branchName, data.type, JSON.stringify(description ?? ''), data.executionDate?.toISOString().slice(0, 10) ?? '',
          netAmount ?? '', data.taxAmount ?? '', collectionStatus, data.invoiceNumber ?? '',
          invoiceDate?.toISOString().slice(0, 10) ?? '', data.creditDays ?? ''].join(','),
      )
    }
  }

  await writeFile('design-reference/flujo-consolidado.csv', csvRows.join('\n'), 'utf8')
  console.log(`Importados ${count} trabajos. Neto total: $${netSum.toLocaleString('es-CL')}`)
  console.log(`Sucursales: ${branchCache.size}. CSV: design-reference/flujo-consolidado.csv`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
