/**
 * Cron: daily cashflow/collection alert scan (informe #13).
 * Vercel cron schedule: "0 14 * * *"  (UTC+0, 14:00 = 11:00 CLT)
 *
 * Reutiliza los mismos predicados ya usados en /flujo ("Control de hoy")
 * — isOverdueV2/isDueSoon (job-presets.ts) — para no duplicar la regla de
 * negocio de qué cuenta como vencido/por vencer. Un solo push por tenant
 * (resumen), no uno por factura — evita spam si hay muchas.
 *
 * Notifica a supervisores + super del tenant afectado (mismo patrón que
 * expiry-alerts). Solo push — sin correo externo (ver informe #19, fuera
 * de alcance de este bloque).
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { notifyTenantStaff } from '@/lib/push'
import { isOverdueV2, isDueSoon } from '@/lib/cashflow/job-presets'

export const runtime = 'nodejs'

function timingSafeStringEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

const JOB_SELECT = {
  id: true,
  code: true,
  netAmount: true,
  financialStage: true,
  commercialStage: true,
  operationalStage: true,
  nonBillable: true,
  purchaseOrder: true,
  purchaseOrderStatus: true,
  invoiceNumber: true,
  invoiceDate: true,
  invoiceStatus: true,
  paymentDate: true,
  paymentAmount: true,
  creditDays: true,
  executionDate: true,
  status: true,
  collectionStatus: true,
  installments: {
    select: {
      netAmount: true, purchaseOrder: true, invoiceNumber: true, invoiceDate: true,
      creditDays: true, paymentDate: true, paymentAmount: true,
    },
  },
} as const

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || !timingSafeStringEqual(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } })
  const now = new Date()
  const results: Record<string, { overdue: number; dueSoon: number }> = {}

  for (const tenant of tenants) {
    // nonBillable y anulado quedan fuera — mismo criterio que isOverdueV2/
    // isDueSoon ya aplican internamente para nonBillable, y un trabajo
    // anulado no tiene cobranza pendiente real.
    const jobs = await prisma.job.findMany({
      where: { tenantId: tenant.id, nonBillable: false, status: { not: 'anulado' } },
      select: JOB_SELECT,
    })

    const overdue = jobs.filter((j) => isOverdueV2(j, now))
    const dueSoon = jobs.filter((j) => isDueSoon(j, now))

    if (overdue.length > 0) {
      await notifyTenantStaff(tenant.id, {
        type: 'cashflow_alert',
        title: `⚠️ ${overdue.length} factura${overdue.length === 1 ? '' : 's'} vencida${overdue.length === 1 ? '' : 's'}`,
        body: overdue.slice(0, 3).map((j) => j.code ?? j.id).join(', ') + (overdue.length > 3 ? '…' : ''),
        href: '/flujo?estado=overdue',
      })
    }
    if (dueSoon.length > 0) {
      await notifyTenantStaff(tenant.id, {
        type: 'cashflow_alert',
        title: `${dueSoon.length} factura${dueSoon.length === 1 ? '' : 's'} vence${dueSoon.length === 1 ? '' : 'n'} esta semana`,
        body: dueSoon.slice(0, 3).map((j) => j.code ?? j.id).join(', ') + (dueSoon.length > 3 ? '…' : ''),
        href: '/flujo?estado=due_soon',
      })
    }

    results[tenant.slug] = { overdue: overdue.length, dueSoon: dueSoon.length }
  }

  return NextResponse.json({ ok: true, results })
}
