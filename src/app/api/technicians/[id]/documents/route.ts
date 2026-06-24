import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessTenant } from '@/lib/tenant'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

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

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const dir = join(process.cwd(), 'public', 'uploads', 'docs', techId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, safeFileName), buffer)

  const fileUrl = `/uploads/docs/${techId}/${safeFileName}`

  const doc = await prisma.technicianDocument.create({
    data: {
      technicianId: techId,
      type: type as never,
      label,
      fileUrl,
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
    select: { id: true },
  })
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.technicianDocument.delete({ where: { id: docId } })
  return NextResponse.json({ ok: true })
}
