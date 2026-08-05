import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { deleteFromR2, getPresignedUrl, isR2Key } from '@/lib/r2'
import { rasterizePdfFirstPage } from '@/lib/pdf-rasterize'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

async function loadTicketForActor(
  ticketId: string,
  role: string,
  tenantId: string,
  userId: string,
) {
  if (role !== 'super' && role !== 'supervisor' && role !== 'tecnico') return null
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
    select: { id: true, folderKey: true, assignedToId: true, otFileUrl: true },
  })
  if (!ticket) return null
  if (role === 'tecnico' && ticket.assignedToId !== userId) return null
  return ticket
}

/**
 * POST /api/tickets/[id]/ot-photo — segundo paso: deja como OT vigente del
 * ticket una key que YA fue subida a R2 vía la URL prefirmada de
 * /upload-url. No recibe bytes.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: ticketId } = await params
  const ticket = await loadTicketForActor(ticketId, session.user.role, session.user.tenantId, session.user.id)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null) as { key?: string } | null
  const key = body?.key
  if (!key) return NextResponse.json({ error: 'Falta la key del archivo' }, { status: 400 })
  const prefix = ticket.folderKey && isR2Key(ticket.folderKey) ? ticket.folderKey : `tickets/${ticketId}`
  if (!key.startsWith(`${prefix}/ot-`)) return NextResponse.json({ error: 'Key inválida' }, { status: 400 })

  const previousKey = ticket.otFileUrl
  await prisma.ticket.update({ where: { id: ticketId }, data: { otFileUrl: key } })
  if (previousKey && isR2Key(previousKey)) await deleteFromR2(previousKey).catch(() => null)
  await logAudit({
    tenantId: session.user.tenantId, actorId: session.user.id, actorRole: session.user.role,
    action: previousKey ? 'ticket_document.replace' : 'ticket_document.create',
    entityType: 'Ticket', entityId: ticketId,
    before: { otFileUrl: previousKey },
    after: { otFileUrl: key },
    source: 'api/tickets/[id]/ot-photo/route.ts:POST',
  })

  return NextResponse.json({ otFileUrl: key })
}

/**
 * GET /api/tickets/[id]/ot-photo — redirige a la OT original (PDF o imagen tal
 * cual se subió).
 * GET /api/tickets/[id]/ot-photo?as=image — siempre devuelve una imagen PNG
 * lista para incrustar (rasteriza la página 1 si la OT es PDF; si ya es
 * imagen, se comporta igual que sin el parámetro). La usa el editor de
 * Informe Técnico para la página final del PDF — Chromium no puede incrustar
 * un PDF dentro de otro PDF vía HTML, así que la OT en PDF se convierte a
 * imagen solo en este punto, nunca al subirla (el archivo original en R2
 * queda intacto).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: ticketId } = await params
  const ticket = await loadTicketForActor(ticketId, session.user.role, session.user.tenantId, session.user.id)
  if (!ticket?.otFileUrl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const wantsImage = new URL(req.url).searchParams.get('as') === 'image'
  const isPdf = ticket.otFileUrl.toLowerCase().endsWith('.pdf')

  if (wantsImage && isPdf) {
    const shortUrl = isR2Key(ticket.otFileUrl) ? await getPresignedUrl(ticket.otFileUrl, 300) : ticket.otFileUrl
    const res = await fetch(shortUrl)
    const page1 = await rasterizePdfFirstPage(new Uint8Array(await res.arrayBuffer()))
    return new NextResponse(new Uint8Array(page1), { headers: { 'Content-Type': 'image/png' } })
  }

  const url = isR2Key(ticket.otFileUrl) ? await getPresignedUrl(ticket.otFileUrl, 3600) : ticket.otFileUrl
  return NextResponse.redirect(url)
}
