/**
 * Cron: recordatorios diarios al técnico sobre sus propios tickets —
 * Vercel cron schedule: "0 13 * * *"  (UTC+0, 13:00 = 10:00 CLT)
 *
 * Dos condiciones (por técnico, via assignedToId — Ticket.assignedToId
 * apunta a User.id, no a Technician.id):
 * - Sin atender: nuevo/en_revision sin cambios en ATTENTION_DAYS.
 * - Falta evidencia: en_ejecucion, 0 documentos adjuntos, sin cambios en EVIDENCE_DAYS.
 *
 * Sin dedup por diseño (mismo patrón que pipeline-alerts): mientras la
 * condición siga vigente, se re-notifica cada corrida. El técnico resuelve
 * la condición (cambia estado / sube evidencia) para que deje de sonar.
 */
import { NextResponse } from 'next/server'
import { timingSafeEqual, createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/push'

export const runtime = 'nodejs'

const ATTENTION_DAYS = 3
const EVIDENCE_DAYS = 3

function timingSafeStringEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || !timingSafeStringEqual(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const attentionCutoff = new Date(now.getTime() - ATTENTION_DAYS * 86_400_000)
  const evidenceCutoff = new Date(now.getTime() - EVIDENCE_DAYS * 86_400_000)

  const [unattended, inExecution] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        assignedToId: { not: null },
        status: { in: ['nuevo', 'en_revision'] },
        deletedAt: null,
        updatedAt: { lte: attentionCutoff },
      },
      select: { id: true, ticketCode: true, title: true, assignedToId: true, tenantId: true },
    }),
    prisma.ticket.findMany({
      where: {
        assignedToId: { not: null },
        status: 'en_ejecucion',
        deletedAt: null,
        updatedAt: { lte: evidenceCutoff },
      },
      select: {
        id: true, ticketCode: true, title: true, assignedToId: true, tenantId: true,
        _count: { select: { documents: true } },
      },
    }),
  ])
  const missingEvidence = inExecution.filter((t) => t._count.documents === 0)

  let notified = 0

  for (const t of unattended) {
    if (!t.assignedToId) continue
    await notify(t.assignedToId, t.tenantId, {
      type: 'ticket_unattended',
      title: '⏰ Ticket sin atender',
      body: `${t.ticketCode} — ${t.title} lleva ${ATTENTION_DAYS}+ días sin avance.`,
      href: `/mi-panel/tickets/${t.id}`,
    })
    notified++
  }

  for (const t of missingEvidence) {
    if (!t.assignedToId) continue
    await notify(t.assignedToId, t.tenantId, {
      type: 'ticket_missing_evidence',
      title: '📷 Falta evidencia fotográfica',
      body: `${t.ticketCode} — ${t.title} en ejecución sin fotos subidas.`,
      href: `/mi-panel/tickets/${t.id}`,
    })
    notified++
  }

  return NextResponse.json({ ok: true, notified, unattended: unattended.length, missingEvidence: missingEvidence.length })
}
