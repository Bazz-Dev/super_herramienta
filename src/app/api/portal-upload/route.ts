import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { uploadToR2 } from '@/lib/r2'

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

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const mimeType = file.type || 'application/octet-stream'
  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const key = `portal/${session.user.tenantId}/${session.user.id}/${Date.now()}-${safeFilename}`

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadToR2(key, buffer, mimeType)
    return NextResponse.json({ key })
  } catch {
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 503 })
  }
}
