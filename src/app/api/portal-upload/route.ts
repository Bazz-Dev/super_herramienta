import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getPresignedUploadUrl } from '@/lib/r2'

export const runtime = 'nodejs'

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

export function isAllowedMimeType(mimeType: string): boolean {
  if (!mimeType) return false
  return ALLOWED_MIME.has(mimeType) || mimeType.startsWith('image/')
}

// Antes solo existía como gate client-side (portal-comment-form.tsx /
// portal-new-ticket-form.tsx) — este endpoint no validaba tamaño en absoluto.
// Mismo límite, ahora también server-side, ya que estamos tocando esta ruta.
const MAX_BYTES = 50 * 1024 * 1024

// POST /api/portal-upload — emite una URL prefirmada de R2 (subida en 2
// pasos, mismo motivo que las demás: el archivo completo por esta función
// serverless topaba con el límite de payload de la plataforma). El
// navegador sube el archivo directo al bucket — ver uploadFiles() en
// portal-comment-form.tsx / portal-new-ticket-form.tsx.
export async function POST(req: NextRequest) {
  const session = await auth()
  const role = session?.user?.role
  if (!session?.user?.id || (role !== 'client' && role !== 'super' && role !== 'supervisor' && role !== 'tecnico')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as { filename?: string; contentType?: string; size?: number } | null
  const filename = body?.filename
  if (!filename) return NextResponse.json({ error: 'Missing filename' }, { status: 400 })
  if (typeof body?.size === 'number' && body.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo demasiado grande (máx. 50 MB)' }, { status: 413 })
  }

  const mimeType = body?.contentType || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const key = `portal/${session.user.tenantId}/${session.user.id}/${Date.now()}-${safeFilename}`

  try {
    const uploadUrl = await getPresignedUploadUrl(key, mimeType)
    return NextResponse.json({ uploadUrl, key, contentType: mimeType })
  } catch {
    return NextResponse.json({ error: 'Error al preparar la subida' }, { status: 503 })
  }
}
