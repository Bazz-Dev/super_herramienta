import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessTenant } from '@/lib/tenant'
import { uploadToR2, deleteFromR2, isR2Key } from '@/lib/r2'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

// Adjunto de OC/Factura directo en Job — mismo patrón que Ticket.otFileUrl
// (scalar en la entidad dueña, no una tabla de documentos aparte): estos
// archivos son privados de este Job, nadie más los referencia nunca, así que
// a diferencia de un documento central compartido, "desvincular" y "borrar
// el objeto R2" son la misma operación segura acá (no hay otra relación que
// pueda quedar huérfana).
type DocField = 'purchaseOrder' | 'invoice'
const FIELD_MAP: Record<DocField, 'purchaseOrderFileUrl' | 'invoiceFileUrl'> = {
  purchaseOrder: 'purchaseOrderFileUrl',
  invoice: 'invoiceFileUrl',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'super' && session.user.role !== 'supervisor') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id: jobId } = await params
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { tenantId: true, purchaseOrderFileUrl: true, invoiceFileUrl: true } })
  if (!job || !canAccessTenant(session.user, job.tenantId)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const form = await req.formData()
  const file = form.get('file') as File | null
  const docField = form.get('docField') as DocField | null

  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })
  if (!docField || !FIELD_MAP[docField]) return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Solo PDF, JPG o PNG' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo mayor a 10 MB' }, { status: 400 })

  const dbField = FIELD_MAP[docField]
  const previousKey = job[dbField]

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const key = `jobs/${jobId}/${docField}-${Date.now()}-${crypto.randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await uploadToR2(key, buf, file.type)

  await prisma.job.update({ where: { id: jobId }, data: { [dbField]: key } })

  // Reemplazo: borra el objeto anterior recién después de que el nuevo quedó
  // escrito y la fila actualizada — nunca deja el campo apuntando a un
  // objeto ya borrado si algo falla a mitad de camino.
  if (previousKey && isR2Key(previousKey)) await deleteFromR2(previousKey).catch(() => null)

  return NextResponse.json({ fileUrl: key })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'super' && session.user.role !== 'supervisor') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id: jobId } = await params
  const { docField } = await req.json() as { docField?: DocField }
  if (!docField || !FIELD_MAP[docField]) return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { tenantId: true, purchaseOrderFileUrl: true, invoiceFileUrl: true } })
  if (!job || !canAccessTenant(session.user, job.tenantId)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const dbField = FIELD_MAP[docField]
  const key = job[dbField]

  await prisma.job.update({ where: { id: jobId }, data: { [dbField]: null } })
  if (key && isR2Key(key)) await deleteFromR2(key).catch(() => null)

  return NextResponse.json({ ok: true })
}
