/**
 * Cron: weekly expiry alert scan — runs every Monday at 8am (Santiago).
 * Vercel cron schedule: "0 11 * * 1"  (UTC+0, 11:00 = 08:00 CLT)
 *
 * Checks within the next 30 days:
 * - Vehicle: revTecnica, SOAP, permisoCirculacion
 * - Technician: contractEndDate (plazo_fijo)
 * - TechnicianDocument: expiryDate
 *
 * Notifies all supervisors + super users of the affected tenant.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyTenantStaff } from '@/lib/push'

export const runtime = 'nodejs'

const ALERT_DAYS = 30

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() + ALERT_DAYS * 86_400_000)
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } })

  const results: Record<string, number> = {}

  for (const tenant of tenants) {
    let alerts = 0

    // ── Vehicle docs ──────────────────────────────────────────────────────────
    const vehicles = await prisma.vehicle.findMany({
      where: {
        tenantId: tenant.id,
        status: 'active',
        OR: [
          { revTecnicaExpiry: { lte: cutoff, gte: new Date() } },
          { soapExpiry: { lte: cutoff, gte: new Date() } },
          { permisoCirculacionExpiry: { lte: cutoff, gte: new Date() } },
        ],
      },
      select: { plate: true, revTecnicaExpiry: true, soapExpiry: true, permisoCirculacionExpiry: true },
    })

    for (const v of vehicles) {
      const checks: Array<[string, Date | null]> = [
        ['Revisión Técnica', v.revTecnicaExpiry],
        ['SOAP', v.soapExpiry],
        ['Permiso de Circulación', v.permisoCirculacionExpiry],
      ]
      for (const [label, date] of checks) {
        if (!date) continue
        const days = daysUntil(date)
        if (days > 0 && days <= ALERT_DAYS) {
          await notifyTenantStaff(tenant.id, {
            type: 'expiry_alert',
            title: `⚠️ ${label} vence en ${days} días`,
            body: `Camioneta ${v.plate}`,
            href: '/recursos/vehiculos',
          })
          alerts++
        }
      }
    }

    // ── Technician contracts ──────────────────────────────────────────────────
    const technicians = await prisma.technician.findMany({
      where: {
        tenantId: tenant.id,
        active: true,
        contractType: 'plazo_fijo',
        contractEndDate: { lte: cutoff, gte: new Date() },
      },
      select: { name: true, contractEndDate: true },
    })

    for (const t of technicians) {
      if (!t.contractEndDate) continue
      const days = daysUntil(t.contractEndDate)
      if (days > 0 && days <= ALERT_DAYS) {
        await notifyTenantStaff(tenant.id, {
          type: 'expiry_alert',
          title: `⚠️ Contrato vence en ${days} días`,
          body: `Técnico: ${t.name}`,
          href: '/recursos/tecnicos',
        })
        alerts++
      }
    }

    // ── Technician documents ──────────────────────────────────────────────────
    const docs = await prisma.technicianDocument.findMany({
      where: {
        technician: { tenantId: tenant.id, active: true },
        expiryDate: { lte: cutoff, gte: new Date() },
      },
      include: { technician: { select: { name: true } } },
    })

    for (const d of docs) {
      if (!d.expiryDate) continue
      const days = daysUntil(d.expiryDate)
      if (days > 0 && days <= ALERT_DAYS) {
        const docLabel = d.label ?? d.type
        await notifyTenantStaff(tenant.id, {
          type: 'expiry_alert',
          title: `⚠️ ${docLabel} vence en ${days} días`,
          body: `Técnico: ${d.technician.name}`,
          href: '/recursos/tecnicos',
        })
        alerts++
      }
    }

    results[tenant.slug] = alerts
  }

  return NextResponse.json({ ok: true, alertsSent: results })
}
