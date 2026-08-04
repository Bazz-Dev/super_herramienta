import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessTenant } from '@/lib/tenant'
import { uploadToR2, deleteFromR2, isR2Key } from '@/lib/r2'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

// Adjunto de OC/Factura directo en Job — mismo patrón que Ticket.otFileUrl
// (scalar en la entidad dueña, no una tabla de documentos aparte): estos
// archivos son privados de este Job, nadie más los referencia nunca, así que
// a diferencia de un documento central compartido, "desvincular" y "borrar
// el objeto R2" son la misma operación segura acá (no hay otra relación que
// pueda quedar huérfana).
//
// installmentId opcional (informe #11): una cuota puede tener su propia OC/
// factura además/en vez de la del Job — mismos campos, mismo endpoint,
// distinta fila de destino. Sin installmentId se sigue comportando exacto
// como antes (compatibilidad con el flujo de un solo pago).
type DocField = 'purchaseOrder' | 'invoice'
const FIELD_MAP: Record<DocField, 'purchaseOrderFileUrl' | 'invoiceFileUrl'> = {
  purchaseOrder: 'purchaseOrderFileUrl',
  invoice: 'invoiceFileUrl',
}
const AUDIT_ENTITY: Record<DocField, string> = {
  purchaseOrder: 'po_document',
  invoice: 'invoice_document',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { role, tenantId, id: actorId } = session.user
  if (role !== 'super' && role !== 'supervisor') {
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
  const installmentId = (form.get('installmentId') as string | null) || null

  if (!file) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })
  if (!docField || !FIELD_MAP[docField]) return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Solo PDF, JPG o PNG' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Archivo mayor a 10 MB' }, { status: 400 })

  const dbField = FIELD_MAP[docField]
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const buf = Buffer.from(await file.arrayBuffer())

  let previousKey: string | null
  let entityType: string
  let entityId: string

  if (installmentId) {
    const installment = await prisma.jobInstallment.findFirst({ where: { id: installmentId, jobId }, select: { purchaseOrderFileUrl: true, invoiceFileUrl: true } })
    if (!installment) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
    previousKey = installment[dbField]
    const key = `jobs/${jobId}/installments/${installmentId}/${docField}-${Date.now()}-${crypto.randomUUID()}.${ext}`
    await uploadToR2(key, buf, file.type)
    await prisma.jobInstallment.update({ where: { id: installmentId }, data: { [dbField]: key } })
    entityType = 'JobInstallment'
    entityId = installmentId
    await logAudit({
      tenantId, actorId, actorRole: role,
      action: `job_installment.${AUDIT_ENTITY[docField]}.${previousKey ? 'replace' : 'attach'}`,
      entityType, entityId,
      before: previousKey ? { [dbField]: previousKey } : undefined,
      after: { [dbField]: key, jobId },
      source: 'api/flujo/trabajos/[id]/documents/route.ts:POST',
    })
    if (previousKey && isR2Key(previousKey)) await deleteFromR2(previousKey).catch(() => null)
    return NextResponse.json({ fileUrl: key })
  }

  previousKey = job[dbField]
  const key = `jobs/${jobId}/${docField}-${Date.now()}-${crypto.randomUUID()}.${ext}`
  await uploadToR2(key, buf, file.type)
  await prisma.job.update({ where: { id: jobId }, data: { [dbField]: key } })
  entityType = 'Job'
  entityId = jobId
  await logAudit({
    tenantId, actorId, actorRole: role,
    action: `job.${AUDIT_ENTITY[docField]}.${previousKey ? 'replace' : 'attach'}`,
    entityType, entityId,
    before: previousKey ? { [dbField]: previousKey } : undefined,
    after: { [dbField]: key },
    source: 'api/flujo/trabajos/[id]/documents/route.ts:POST',
  })

  // Reemplazo: borra el objeto anterior recién después de que el nuevo quedó
  // escrito y la fila actualizada — nunca deja el campo apuntando a un
  // objeto ya borrado si algo falla a mitad de camino.
  if (previousKey && isR2Key(previousKey)) await deleteFromR2(previousKey).catch(() => null)

  return NextResponse.json({ fileUrl: key })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { role, tenantId, id: actorId } = session.user
  if (role !== 'super' && role !== 'supervisor') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id: jobId } = await params
  const { docField, installmentId } = await req.json() as { docField?: DocField; installmentId?: string | null }
  if (!docField || !FIELD_MAP[docField]) return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { tenantId: true, purchaseOrderFileUrl: true, invoiceFileUrl: true } })
  if (!job || !canAccessTenant(session.user, job.tenantId)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const dbField = FIELD_MAP[docField]

  if (installmentId) {
    const installment = await prisma.jobInstallment.findFirst({ where: { id: installmentId, jobId }, select: { purchaseOrderFileUrl: true, invoiceFileUrl: true } })
    if (!installment) return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 404 })
    const key = installment[dbField]
    await prisma.jobInstallment.update({ where: { id: installmentId }, data: { [dbField]: null } })
    await logAudit({
      tenantId, actorId, actorRole: role,
      action: `job_installment.${AUDIT_ENTITY[docField]}.unlink`,
      entityType: 'JobInstallment', entityId: installmentId,
      before: { [dbField]: key }, after: { jobId },
      source: 'api/flujo/trabajos/[id]/documents/route.ts:DELETE',
    })
    if (key && isR2Key(key)) await deleteFromR2(key).catch(() => null)
    return NextResponse.json({ ok: true })
  }

  const key = job[dbField]
  await prisma.job.update({ where: { id: jobId }, data: { [dbField]: null } })
  await logAudit({
    tenantId, actorId, actorRole: role,
    action: `job.${AUDIT_ENTITY[docField]}.unlink`,
    entityType: 'Job', entityId: jobId,
    before: { [dbField]: key },
    source: 'api/flujo/trabajos/[id]/documents/route.ts:DELETE',
  })
  if (key && isR2Key(key)) await deleteFromR2(key).catch(() => null)

  return NextResponse.json({ ok: true })
}
