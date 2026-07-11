import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getPresignedPutUrl } from '@/lib/r2'

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

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = session?.user?.role
  if (!session?.user?.id || (role !== 'client' && role !== 'super' && role !== 'supervisor' && role !== 'tecnico')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { filename?: string; mimeType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { filename, mimeType } = body
  if (!filename || !mimeType) {
    return NextResponse.json({ error: 'Missing filename or mimeType' }, { status: 400 })
  }

  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const key = `portal/${session.user.tenantId}/${session.user.id}/${Date.now()}-${safeFilename}`

  try {
    const url = await getPresignedPutUrl(key, mimeType, 300)
    return NextResponse.json({ url, key })
  } catch {
    return NextResponse.json({ error: 'Error generando URL de subida' }, { status: 503 })
  }
}
