import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedUploadUrl } from '@/lib/r2'

export const runtime = 'nodejs'

// POST /api/client-documents/upload-url — primer paso de la subida en 2 pasos
// para documentos de cliente (drag-and-drop en /documentos, fotos/OT del
// editor de Informe una vez hay ticket vinculado). Antes este endpoint subía
// el binario server-side (comentario viejo: "no PUT directo del navegador a
// R2, que requeriría CORS configurado en el bucket") — eso es justo lo que
// hacía que el archivo completo pasara por esta función serverless y topara
// con el límite de payload de la plataforma (~4.5MB, confirmado en vivo el
// 2026-07-30). Ahora solo valida y emite una URL prefirmada; el navegador
// sube los bytes directo a R2 (ver uploadDirect en src/lib/upload-direct.ts).
// Requiere CORS del bucket configurado — ver docs/architecture/GAP_REGISTER.md.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as { clientId?: string; filename?: string; contentType?: string } | null
  const clientId = body?.clientId
  const filename = body?.filename
  if (!clientId || !filename) {
    return NextResponse.json({ error: 'Missing clientId or filename' }, { status: 400 })
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId: session.user.tenantId ?? '' },
    select: { id: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150)
  const key = `clients/${clientId}/documentos/${Date.now()}-${safeFilename}`
  const contentType = body?.contentType || 'application/octet-stream'
  const uploadUrl = await getPresignedUploadUrl(key, contentType)

  return NextResponse.json({ uploadUrl, key, contentType })
}
