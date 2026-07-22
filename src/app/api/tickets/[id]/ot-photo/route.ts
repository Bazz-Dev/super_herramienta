import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, deleteFromR2, getPresignedUrl, isR2Key } from '@/lib/r2'
import { rasterizePdfFirstPage } from '@/lib/pdf-rasterize'

export const runtime = 'nodejs'

// Los técnicos escanean la OT en terreno (apps de escaneo → PDF), así que PDF
// es el formato normal; imagen queda como respaldo si alguien manda solo una foto.
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp']
const MAX_BYTES = 12 * 1024 * 1024

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

/** POST /api/tickets/[id]/ot-photo — sube/reemplaza la OT del ticket (PDF o imagen) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: ticketId } = await params
  const ticket = await loadTicketForActor(ticketId, session.user.role, session.user.tenantId, session.user.id)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo demasiado grande (máx. 12 MB)' }, { status: 413 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  if (!ALLOWED_EXT.includes(ext)) return NextResponse.json({ error: 'Formato no permitido (usa PDF o foto)' }, { status: 415 })

  const prefix = ticket.folderKey && isR2Key(ticket.folderKey) ? ticket.folderKey : `tickets/${ticketId}`
  const key = `${prefix}/ot-${randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buf, file.type || 'application/pdf')

  const previousKey = ticket.otFileUrl
  await prisma.ticket.update({ where: { id: ticketId }, data: { otFileUrl: key } })
  if (previousKey && isR2Key(previousKey)) await deleteFromR2(previousKey).catch(() => null)

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
