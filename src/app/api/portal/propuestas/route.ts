import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isR2Key } from '@/lib/r2'

export const runtime = 'nodejs'

// GET /api/portal/propuestas?id=xxx
// Portal-safe: client role can only fetch their own propuestas.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const doc = await prisma.clientDocument.findFirst({
    where: { id, type: 'propuesta' },
    select: { id: true, clientId: true, dataJson: true, fileKey: true, title: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { role } = session.user
  const clientId = (session.user as { clientId?: string }).clientId
  const allowed =
    role === 'super' || role === 'supervisor' ||
    (role === 'client' && !!clientId && doc.clientId === clientId)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Bug real reportado en vivo: URL prefirmada de R2 directa -- el CORS del
  // bucket solo permite PUT (GAP_REGISTER G63), así que cualquier HEAD/GET
  // desde el navegador contra ella fallaba siempre. Ruta propia en su lugar,
  // mismo origen, sin CORS de por medio (ver /api/portal/informes).
  const viewUrl = isR2Key(doc.fileKey) ? `/api/files?key=${encodeURIComponent(doc.fileKey)}&type=client-document` : null
  return NextResponse.json({ dataJson: doc.dataJson, viewUrl, title: doc.title })
}
