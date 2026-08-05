import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { deleteFromR2, getObjectBuffer, isR2Key } from '@/lib/r2'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

/**
 * GET /api/tickets/[id]/documents?docId=xxx — bytes crudos del documento.
 * A diferencia de /api/files (redirect 307 a una URL firmada de R2, pensado
 * para <img src>/<a href>), acá se bajan los bytes server-side y se
 * devuelven directo: el informe técnico arma sus fotos con fetch().blob()
 * client-side, y un fetch a una URL cross-origin (el bucket R2) tras el
 * redirect requiere CORS en el bucket — server-to-R2 no tiene esa restricción.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: ticketId } = await params
  const docId = new URL(req.url).searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

  const doc = await prisma.ticketDocument.findFirst({
    where: { id: docId, ticketId, ticket: { tenantId: session.user.tenantId } },
    select: { fileUrl: true, mimeType: true },
  })
  if (!doc || !isR2Key(doc.fileUrl)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buf = await getObjectBuffer(doc.fileUrl)
  return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': doc.mimeType ?? 'application/octet-stream' } })
}

/**
 * POST /api/tickets/[id]/documents — segundo paso: registra un documento
 * cuyos bytes YA fueron subidos directo a R2 vía la URL prefirmada de
 * /upload-url (ver ese archivo). No recibe bytes, solo la key + metadata.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { role, tenantId } = session.user
  if (role !== 'super' && role !== 'supervisor' && role !== 'tecnico') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: ticketId } = await params
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, tenantId }, select: { id: true, folderKey: true, assignedToId: true } })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // G23: el técnico solo puede subir evidencia a tickets asignados a él
  if (role === 'tecnico' && ticket.assignedToId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { key?: string; name?: string; mimeType?: string } | null
  const key = body?.key
  const name = body?.name
  if (!key || !name) return NextResponse.json({ error: 'Faltan datos del documento' }, { status: 400 })
  // La key debe caer bajo la carpeta esperada del ticket — nunca confiar en
  // una key arbitraria del cliente para el registro final.
  const prefix = ticket.folderKey && isR2Key(ticket.folderKey) ? ticket.folderKey : `tickets/${ticketId}`
  if (!key.startsWith(`${prefix}/`)) return NextResponse.json({ error: 'Key inválida' }, { status: 400 })

  const doc = await prisma.ticketDocument.create({
    data: { ticketId, name, fileUrl: key, mimeType: body?.mimeType || null, uploadedById: session.user.id },
  })
  await logAudit({
    tenantId, actorId: session.user.id, actorRole: role,
    action: 'ticket_document.create', entityType: 'TicketDocument', entityId: doc.id,
    after: { ticketId, name: doc.name, mimeType: doc.mimeType },
    source: 'api/tickets/[id]/documents/route.ts:POST',
  })

  return NextResponse.json({ id: doc.id, name: doc.name, fileUrl: doc.fileUrl, mimeType: doc.mimeType, uploadedAt: doc.uploadedAt })
}

/** DELETE /api/tickets/[id]/documents?docId=xxx */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { role, tenantId } = session.user
  if (role !== 'super' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: ticketId } = await params
  const docId = new URL(req.url).searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

  const doc = await prisma.ticketDocument.findFirst({
    where: { id: docId, ticketId, ticket: { tenantId } },
    select: { id: true, fileUrl: true, name: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.ticketDocument.delete({ where: { id: docId } })
  if (isR2Key(doc.fileUrl)) await deleteFromR2(doc.fileUrl).catch(() => null)
  await logAudit({
    tenantId, actorId: session.user.id, actorRole: role,
    action: 'ticket_document.delete', entityType: 'TicketDocument', entityId: docId,
    before: { ticketId, name: doc.name },
    source: 'api/tickets/[id]/documents/route.ts:DELETE',
  })

  return NextResponse.json({ ok: true })
}
