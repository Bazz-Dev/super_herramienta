export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { auth } from '@/auth'
import { listJobs } from '@/lib/cashflow/queries'
import { JOB_TYPE_LABELS, COLLECTION_LABELS, COST_CATEGORY_LABELS } from '@/lib/cashflow/labels'

function clpNum(v: number | null) { return v ?? 0 }

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const actor = {
    id: session.user.id,
    role: session.user.role as 'super' | 'supervisor' | 'client',
    tenantId: session.user.tenantId,
  }

  const sp = req.nextUrl.searchParams
  const opts = {
    clientId: sp.get('cliente') ?? undefined,
    collectionStatus: sp.get('estado') ?? undefined,
    tipo: sp.get('tipo') ?? undefined,
    branchId: sp.get('sucursal') ?? undefined,
    from: sp.get('desde') ? new Date(sp.get('desde')!) : undefined,
    to: sp.get('hasta') ? new Date(sp.get('hasta')!) : undefined,
  }

  const jobs = await listJobs(actor, opts)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'INGEGAR Platform'
  wb.created = new Date()

  // Sheet 1: Jobs summary
  const ws = wb.addWorksheet('Trabajos')
  ws.columns = [
    { header: 'Fecha ejecución', key: 'date', width: 16 },
    { header: 'Cliente', key: 'client', width: 24 },
    { header: 'Sucursal', key: 'branch', width: 24 },
    { header: 'Descripción', key: 'desc', width: 40 },
    { header: 'Tipo', key: 'type', width: 16 },
    { header: 'N° factura', key: 'invoice', width: 14 },
    { header: 'Fecha factura', key: 'invoiceDate', width: 16 },
    { header: 'Fecha pago', key: 'paymentDate', width: 16 },
    { header: 'OC / Referencia', key: 'po', width: 20 },
    { header: 'Neto (CLP)', key: 'net', width: 14 },
    { header: 'IVA (CLP)', key: 'tax', width: 12 },
    { header: 'Total (CLP)', key: 'total', width: 14 },
    { header: 'Total costos', key: 'costs', width: 14 },
    { header: 'Margen', key: 'margin', width: 12 },
    { header: 'Estado cobranza', key: 'status', width: 18 },
  ]

  // Header row style
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FF111111' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5B100' } }

  for (const j of jobs) {
    const totalCosts = j.costs.reduce((s, c) => s + c.amount, 0)
    const net = clpNum(j.netAmount)
    const tax = clpNum(j.taxAmount)
    ws.addRow({
      date: j.executionDate ? j.executionDate.toISOString().slice(0, 10) : '',
      client: j.client.name,
      branch: j.branch?.name ?? '',
      desc: j.description ?? '',
      type: JOB_TYPE_LABELS[j.type] ?? j.type,
      invoice: j.invoiceNumber ?? '',
      invoiceDate: j.invoiceDate ? j.invoiceDate.toISOString().slice(0, 10) : '',
      paymentDate: j.paymentDate ? j.paymentDate.toISOString().slice(0, 10) : '',
      po: j.purchaseOrder ?? '',
      net,
      tax,
      total: net + tax,
      costs: totalCosts,
      margin: net - totalCosts,
      status: COLLECTION_LABELS[j.collectionStatus] ?? j.collectionStatus,
    })
  }

  // Currency format for number columns
  for (const col of ['net', 'tax', 'total', 'costs', 'margin']) {
    ws.getColumn(col).numFmt = '#,##0'
  }

  // Sheet 2: Costs detail
  const ws2 = wb.addWorksheet('Costos detalle')
  ws2.columns = [
    { header: 'Fecha ejecución', key: 'date', width: 16 },
    { header: 'Cliente', key: 'client', width: 24 },
    { header: 'Sucursal', key: 'branch', width: 24 },
    { header: 'Descripción trabajo', key: 'desc', width: 40 },
    { header: 'Categoría costo', key: 'category', width: 18 },
    { header: 'Proveedor', key: 'supplier', width: 24 },
    { header: 'Ref. documento', key: 'docref', width: 18 },
    { header: 'Monto (CLP)', key: 'amount', width: 14 },
  ]
  const h2 = ws2.getRow(1)
  h2.font = { bold: true }
  h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5B100' } }

  for (const j of jobs) {
    for (const c of j.costs) {
      ws2.addRow({
        date: j.executionDate ? j.executionDate.toISOString().slice(0, 10) : '',
        client: j.client.name,
        branch: j.branch?.name ?? '',
        desc: j.description ?? '',
        category: COST_CATEGORY_LABELS[c.category] ?? c.category,
        supplier: c.supplier ?? '',
        docref: c.documentRef ?? '',
        amount: c.amount,
      })
    }
  }
  ws2.getColumn('amount').numFmt = '#,##0'

  const buffer = await wb.xlsx.writeBuffer()
  const now = new Date().toISOString().slice(0, 10)
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="flujo-${now}.xlsx"`,
    },
  })
}
