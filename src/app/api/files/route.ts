import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedUrl, isR2Key } from '@/lib/r2'
import { ticketFileFilter } from '@/lib/files-access'

export const runtime = 'nodejs'

/**
 * GET /api/files?key=tickets/abc/file.pdf&type=ticket|technician
 *
 * Validates the caller owns access to the resource that contains this key,
 * then issues a 307 redirect to a 1-hour presigned R2 URL.
 * Never exposes the signed URL to the browser URL bar (redirect, not JSON).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const type = searchParams.get('type') as 'ticket' | 'technician' | 'company' | 'job' | 'client-editor' | null

  if (!key || !type) {
    return NextResponse.json({ error: 'Missing key or type' }, { status: 400 })
  }

  if (!isR2Key(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  }

  const { tenantId, role } = session.user

  // Verify the requesting user actually owns a document with this key
  if (type === 'client-editor') {
    // Fotos/OT recién subidas desde el editor de Informe Técnico — todavía no
    // son un ClientDocument (eso ocurre recién al "Guardar en cliente"), así
    // que no hay fila de dueño que verificar; el gate es el mismo que ya usa
    // /api/client-documents y /api/client-documents/upload-url para esta
    // función (staff del tenant, sin excepción por cliente puntual).
    if (role !== 'super' && role !== 'supervisor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (type === 'ticket') {
    const ticketFilter = ticketFileFilter(role, tenantId, session.user.id, session.user.clientId)
    const doc = await prisma.ticketDocument.findFirst({
      where: { fileUrl: key, ticket: ticketFilter },
      select: { id: true },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } else if (type === 'technician') {
    const doc = await prisma.technicianDocument.findFirst({
      where: {
        fileUrl: key,
        technician: role === 'super' ? undefined : { tenantId },
      },
      select: { id: true },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } else if (type === 'company') {
    const doc = await prisma.companyDocument.findFirst({
      where: { fileUrl: key, tenantId: role === 'super' ? undefined : tenantId },
      select: { id: true },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } else if (type === 'job') {
    const doc = await prisma.job.findFirst({
      where: {
        OR: [{ purchaseOrderFileUrl: key }, { invoiceFileUrl: key }],
        ...(role === 'super' ? {} : { tenantId }),
      },
      select: { id: true },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  } else {
    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  }

  const url = await getPresignedUrl(key, 3600)
  return NextResponse.redirect(url, 307)
}
