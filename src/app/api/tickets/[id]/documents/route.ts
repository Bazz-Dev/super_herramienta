import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, deleteFromR2, getObjectBuffer, isR2Key } from '@/lib/r2'

export const runtime = 'nodejs'

const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'zip']
const MAX_BYTES = 10 * 1024 * 1024

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

/** POST /api/tickets/[id]/documents */
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

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo demasiado grande (máx. 10 MB)' }, { status: 413 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  if (!ALLOWED_EXT.includes(ext)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 415 })

  const prefix = ticket.folderKey && isR2Key(ticket.folderKey)
    ? ticket.folderKey
    : `tickets/${ticketId}`
  const key = `${prefix}/${randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buf, file.type || 'application/octet-stream')

  const doc = await prisma.ticketDocument.create({
    data: { ticketId, name: file.name, fileUrl: key, mimeType: file.type || null, uploadedById: session.user.id },
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
    select: { id: true, fileUrl: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.ticketDocument.delete({ where: { id: docId } })
  if (isR2Key(doc.fileUrl)) await deleteFromR2(doc.fileUrl).catch(() => null)

  return NextResponse.json({ ok: true })
}
