import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedUploadUrl, isR2Key } from '@/lib/r2'

export const runtime = 'nodejs'

const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp']
const MAX_BYTES = 12 * 1024 * 1024

/**
 * POST /api/tickets/[id]/ot-photo/upload-url — primer paso de la subida en 2
 * pasos (mismo motivo que documents/upload-url: evitar el límite de payload
 * de la función serverless). El navegador sube el PDF/foto directo a R2 y
 * recién después llama a POST /api/tickets/[id]/ot-photo (sin /upload-url)
 * para dejarla como la OT vigente del ticket.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { role, tenantId, id: userId } = session.user
  if (role !== 'super' && role !== 'supervisor' && role !== 'tecnico') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: ticketId } = await params
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, tenantId }, select: { id: true, folderKey: true, assignedToId: true } })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role === 'tecnico' && ticket.assignedToId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { filename?: string; contentType?: string; size?: number } | null
  const filename = body?.filename
  if (!filename) return NextResponse.json({ error: 'Falta el nombre del archivo' }, { status: 400 })
  if (typeof body?.size === 'number' && body.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx. 12 MB)' }, { status: 413 })
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'pdf'
  if (!ALLOWED_EXT.includes(ext)) return NextResponse.json({ error: 'Formato no permitido (usa PDF o foto)' }, { status: 415 })

  const prefix = ticket.folderKey && isR2Key(ticket.folderKey) ? ticket.folderKey : `tickets/${ticketId}`
  const key = `${prefix}/ot-${randomUUID()}.${ext}`
  const contentType = body?.contentType || 'application/pdf'
  const uploadUrl = await getPresignedUploadUrl(key, contentType)

  return NextResponse.json({ uploadUrl, key, contentType })
}
