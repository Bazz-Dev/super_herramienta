import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2 } from '@/lib/r2'

export const runtime = 'nodejs'

// POST /api/client-documents/upload-url — sube un documento arrastrado-y-soltado
// (informes/OT/etc. anteriores a "guardar en carpeta") a la carpeta de un cliente en
// /documentos. El binario pasa por este endpoint y sube a R2 server-side (no PUT
// directo del navegador a R2, que requeriría CORS configurado en el bucket).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData()
  const clientId = form.get('clientId')
  const file = form.get('file')
  if (typeof clientId !== 'string' || !clientId || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing clientId or file' }, { status: 400 })
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId: session.user.tenantId ?? '' },
    select: { id: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150)
  const key = `clients/${clientId}/documentos/${Date.now()}-${safeFilename}`
  const mimeType = file.type || 'application/octet-stream'

  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buffer, mimeType)
  return NextResponse.json({ key })
}
