import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedUploadUrl, isR2Key } from '@/lib/r2'

export const runtime = 'nodejs'

const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'zip']
const MAX_BYTES = 10 * 1024 * 1024

/**
 * POST /api/tickets/[id]/documents/upload-url — primer paso de la subida en
 * 2 pasos (bug real: el archivo completo por esta función serverless topaba
 * con el límite de payload de la plataforma, ~4.5MB, confirmado en vivo el
 * 2026-07-30 con fotos de celular normales). Este endpoint solo valida y
 * emite una URL prefirmada de R2 — el navegador sube los bytes directo al
 * bucket (ver PUT en tecnico-ticket-actions.tsx), y recién después llama a
 * POST /api/tickets/[id]/documents (sin /upload-url) para registrar el
 * documento ya subido. Mismos chequeos de auth/rol/tenant que antes tenía
 * el POST original — nada se relaja.
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
  if (role === 'tecnico' && ticket.assignedToId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { filename?: string; contentType?: string; size?: number } | null
  const filename = body?.filename
  if (!filename) return NextResponse.json({ error: 'Falta el nombre del archivo' }, { status: 400 })
  if (typeof body?.size === 'number' && body.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx. 10 MB)' }, { status: 413 })
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin'
  if (!ALLOWED_EXT.includes(ext)) return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 415 })

  const prefix = ticket.folderKey && isR2Key(ticket.folderKey)
    ? ticket.folderKey
    : `tickets/${ticketId}`
  const key = `${prefix}/${randomUUID()}.${ext}`
  const contentType = body?.contentType || 'application/octet-stream'
  const uploadUrl = await getPresignedUploadUrl(key, contentType)

  return NextResponse.json({ uploadUrl, key, contentType })
}
