import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedPutUrl } from '@/lib/r2'

export const runtime = 'nodejs'

// POST /api/client-documents/upload-url — presigned PUT URL for arrastrar-y-soltar
// de documentos pre-existentes (informes/OT/etc. anteriores a "guardar en carpeta")
// directo a la carpeta de un cliente en /documentos, sin pasar el binario por el server.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { clientId, filename, mimeType } = (await req.json()) as { clientId?: string; filename?: string; mimeType?: string }
  if (!clientId || !filename || !mimeType) {
    return NextResponse.json({ error: 'Missing clientId, filename or mimeType' }, { status: 400 })
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId: session.user.tenantId ?? '' },
    select: { id: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150)
  const key = `clients/${clientId}/documentos/${Date.now()}-${safeFilename}`

  const url = await getPresignedPutUrl(key, mimeType, 300)
  return NextResponse.json({ url, key })
}
