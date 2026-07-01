import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET /api/portal/informes?id=xxx
// Used by portal client to fetch dataJson for PDF generation.
// Requires auth — client role + document must belong to the user's client.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const doc = await prisma.clientDocument.findFirst({
    where: { id, type: 'informe' },
    select: { id: true, clientId: true, dataJson: true, title: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Staff (super/supervisor) can access any document in their tenant
  const role = session.user.role
  if (role === 'super' || role === 'supervisor') {
    return NextResponse.json({ dataJson: doc.dataJson, title: doc.title })
  }

  // Client role: only documents that belong to their own client
  const clientId = (session.user as { clientId?: string }).clientId
  if (role === 'client' && clientId && doc.clientId === clientId) {
    return NextResponse.json({ dataJson: doc.dataJson, title: doc.title })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
