import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { uploadToR2, deleteFromR2, isR2Key } from '@/lib/r2'
import type { CompanyDocType } from '@/generated/prisma/enums'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

function requireStaff(role: string | undefined) {
  return role === 'super' || role === 'supervisor'
}

/** POST /api/company-documents — sube un documento de empresa (reglamento, mutualidad, etc.) */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !requireStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const type = (form.get('type') as string) || 'otro'
  const label = (form.get('label') as string) || null

  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Solo PDF, JPG o PNG' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo mayor a 10 MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const key = `company/${session.user.tenantId}/${Date.now()}-${randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buf, file.type)

  const doc = await prisma.companyDocument.create({
    data: { tenantId: session.user.tenantId, type: type as CompanyDocType, label, fileUrl: key },
  })

  return NextResponse.json({ doc })
}

/** DELETE /api/company-documents?docId=xxx */
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !requireStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const docId = new URL(req.url).searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'Falta docId' }, { status: 400 })

  const doc = await prisma.companyDocument.findFirst({
    where: { id: docId, tenantId: session.user.tenantId },
    select: { id: true, fileUrl: true },
  })
  if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  await prisma.companyDocument.delete({ where: { id: docId } })
  if (isR2Key(doc.fileUrl)) await deleteFromR2(doc.fileUrl).catch(() => null)

  return NextResponse.json({ ok: true })
}
