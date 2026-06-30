import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessTenant } from '@/lib/tenant'
import { uploadToR2, deleteFromR2, isR2Key } from '@/lib/r2'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: techId } = await params
  const tech = await prisma.technician.findUnique({ where: { id: techId }, select: { tenantId: true } })
  if (!tech || !canAccessTenant(session.user, tech.tenantId)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const type = (form.get('type') as string) || 'otro'
  const label = (form.get('label') as string) || null
  const expiryDate = (form.get('expiryDate') as string) || null
  const notes = (form.get('notes') as string) || null

  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Solo PDF, JPG o PNG' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo mayor a 10 MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const key = `technicians/${techId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buf, file.type)

  const doc = await prisma.technicianDocument.create({
    data: {
      technicianId: techId,
      type: type as never,
      label,
      fileUrl: key,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      notes,
    },
  })

  return NextResponse.json({ doc })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: techId } = await params
  const { docId } = await req.json()

  const doc = await prisma.technicianDocument.findFirst({
    where: { id: docId, technicianId: techId, technician: { tenantId: session.user.tenantId } },
    select: { id: true, fileUrl: true },
  })
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.technicianDocument.delete({ where: { id: docId } })

  if (isR2Key(doc.fileUrl)) await deleteFromR2(doc.fileUrl).catch(() => null)

  return NextResponse.json({ ok: true })
}
