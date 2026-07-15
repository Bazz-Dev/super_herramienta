import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyTenantStaff } from '@/lib/push'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const stale = await prisma.clientDocument.findMany({
    where: {
      proposalStatus: { in: ['enviada', 'vista'] },
      responseAt: null,
      OR: [
        { followUpAt: { lte: now } },
        { sentAt: { lte: sevenDaysAgo } },
      ],
    },
    select: { tenantId: true },
  })

  if (stale.length === 0) {
    return NextResponse.json({ notified: 0, proposals: 0 })
  }

  // Group by tenant
  const byTenant = stale.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.tenantId] = (acc[doc.tenantId] ?? 0) + 1
    return acc
  }, {})

  await Promise.all(
    Object.entries(byTenant).map(([tenantId, count]) =>
      notifyTenantStaff(tenantId, {
        type: 'pipeline_followup',
        title: 'Seguimiento de propuestas',
        body: `${count} propuesta${count > 1 ? 's' : ''} sin respuesta · Revisa el pipeline.`,
        href: '/pipeline',
      }),
    ),
  )

  return NextResponse.json({ notified: Object.keys(byTenant).length, proposals: stale.length })
}
