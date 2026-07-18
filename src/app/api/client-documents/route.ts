import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { deleteFromR2, getPresignedUrl, isR2Key } from '@/lib/r2'
import { tenantScope } from '@/lib/tenant'
import type { ClientDocType } from '@/generated/prisma/enums'

export const runtime = 'nodejs'

// POST /api/client-documents — save editor data (JSON) in DB, no R2 upload
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { clientId, type, title, dataJson, metadata, fileKey } = body

  // Either the JSON-editable format (dataJson → fileKey='inline') or a real R2
  // file already uploaded via /api/client-documents/upload-url (fileKey set).
  if (!clientId || !title?.trim() || (!dataJson && !fileKey)) {
    return NextResponse.json({ error: 'Missing required fields: clientId, title, dataJson or fileKey' }, { status: 400 })
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId: session.user.tenantId ?? '' },
    select: { id: true },
  })
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const doc = await prisma.clientDocument.create({
    data: {
      tenantId: session.user.tenantId ?? '',
      clientId,
      type: (type ?? 'otro') as ClientDocType,
      title: title.trim(),
      fileKey: fileKey && !dataJson ? fileKey : 'inline',
      dataJson: dataJson ? (typeof dataJson === 'string' ? dataJson : JSON.stringify(dataJson)) : undefined,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
      // FK real (G2) además del legado en metadata — el legado se mantiene por compat
      ticketId: metadata?.ticketId ?? undefined,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ success: true, id: doc.id })
}

// PATCH /api/client-documents — update an existing document's data
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { id, title, dataJson, metadata } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const doc = await prisma.clientDocument.findFirst({
    where: { id, tenantId: session.user.tenantId ?? '' },
    select: { id: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.clientDocument.update({
    where: { id },
    data: {
      ...(title?.trim() ? { title: title.trim() } : {}),
      ...(dataJson ? { dataJson: typeof dataJson === 'string' ? dataJson : JSON.stringify(dataJson) } : {}),
      ...(metadata ? { metadata: JSON.stringify(metadata) } : {}),
    },
  })

  return NextResponse.json({ success: true })
}

// GET /api/client-documents?clientId=xxx&id=xxx
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  const clientId = req.nextUrl.searchParams.get('clientId')
  const actor = { role: session.user.role, tenantId: session.user.tenantId ?? '' }

  // Single document fetch (for editor reload)
  if (id) {
    const doc = await prisma.clientDocument.findFirst({
      where: { id, ...tenantScope(actor) },
      include: { client: { select: { id: true, name: true } } },
    })
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // Return top-level dataJson for convenient destructuring in portal downloads
    const viewUrl = isR2Key(doc.fileKey) ? await getPresignedUrl(doc.fileKey, 3600) : null
    return NextResponse.json({ doc, dataJson: doc.dataJson, viewUrl })
  }

  const where = clientId
    ? { clientId, ...tenantScope(actor) }
    : { ...tenantScope(actor) }

  const docs = await prisma.clientDocument.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
    // Exclude dataJson from list view (can be large)
    omit: { dataJson: true },
  })

  // Sign URLs only for actual R2 files
  const withUrls = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      viewUrl: isR2Key(d.fileKey) ? await getPresignedUrl(d.fileKey, 3600) : null,
    }))
  )

  return NextResponse.json({ docs: withUrls })
}

// DELETE /api/client-documents?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !['super', 'supervisor'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const doc = await prisma.clientDocument.findFirst({
    where: { id, tenantId: session.user.tenantId ?? '' },
    select: { fileKey: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (isR2Key(doc.fileKey)) await deleteFromR2(doc.fileKey)
  await prisma.clientDocument.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
