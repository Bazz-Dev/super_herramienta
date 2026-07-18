import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isR2Key, getPresignedUrl } from '@/lib/r2'

export const runtime = 'nodejs'

// GET /api/portal/informes?id=xxx
// Used by portal client to fetch dataJson (JSON editable) for PDF generation,
// or a presigned viewUrl when the informe is a real R2 file (e.g. historical
// informes técnicos linked from ticket evidence — no dataJson to render).
// Requires auth — client role + document must belong to the user's client.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const doc = await prisma.clientDocument.findFirst({
    where: { id, type: 'informe' },
    select: { id: true, clientId: true, dataJson: true, fileKey: true, title: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = session.user.role
  const clientId = (session.user as { clientId?: string }).clientId
  const allowed =
    role === 'super' || role === 'supervisor' ||
    (role === 'client' && !!clientId && doc.clientId === clientId)
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const viewUrl = isR2Key(doc.fileKey) ? await getPresignedUrl(doc.fileKey, 3600) : null
  return NextResponse.json({ dataJson: doc.dataJson, viewUrl, title: doc.title })
}
