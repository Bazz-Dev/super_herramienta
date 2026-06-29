import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

/** POST /api/tickets/[id]/documents — upload a file to a ticket */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { role, tenantId } = session.user
  if (role !== 'super' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: ticketId } = await params

  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, tenantId }, select: { id: true } })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  // 10 MB limit
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'zip']
  if (!allowed.includes(ext)) return NextResponse.json({ error: 'File type not allowed' }, { status: 415 })

  const filename = `${randomUUID()}.${ext}`
  const dir = join(process.cwd(), 'public', 'uploads', 'tickets', ticketId)
  await mkdir(dir, { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(join(dir, filename), buf)

  const fileUrl = `/uploads/tickets/${ticketId}/${filename}`

  const doc = await prisma.ticketDocument.create({
    data: {
      ticketId,
      name: file.name,
      fileUrl,
      uploadedById: session.user.id,
    },
  })

  return NextResponse.json({ id: doc.id, name: doc.name, fileUrl: doc.fileUrl })
}

/** DELETE /api/tickets/[id]/documents?docId=xxx */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { role, tenantId } = session.user
  if (role !== 'super' && role !== 'supervisor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: ticketId } = await params
  const docId = new URL(req.url).searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 })

  const doc = await prisma.ticketDocument.findFirst({
    where: { id: docId, ticketId, ticket: { tenantId } },
    select: { id: true },
  })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.ticketDocument.delete({ where: { id: docId } })
  return NextResponse.json({ ok: true })
}
