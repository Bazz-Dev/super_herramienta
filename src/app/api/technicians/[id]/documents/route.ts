import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessTenant } from '@/lib/tenant'
import { deleteFromR2, isR2Key } from '@/lib/r2'
import { fromDateInput } from '@/lib/cashflow/dates'
import type { DocType } from '@/generated/prisma/enums'

export const runtime = 'nodejs'

/**
 * POST /api/technicians/[id]/documents — segundo paso: registra un
 * documento (contrato/carnet/otro) cuyos bytes YA fueron subidos directo a
 * R2 vía la URL prefirmada de /upload-url (ver ese archivo). No recibe
 * bytes, solo la key + metadata -- antes recibía el archivo completo por
 * FormData a través de esta misma función serverless, topando con el
 * límite de payload de la plataforma (bug real reportado en vivo: "Unexpected
 * token… is not valid JSON", mismo bug class que GAP_REGISTER G63 ya cerró
 * para tickets/informes/portal, nunca migrado acá).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: techId } = await params
  const tech = await prisma.technician.findUnique({ where: { id: techId }, select: { tenantId: true } })
  if (!tech || !canAccessTenant(session.user, tech.tenantId)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => null) as {
    key?: string; type?: string; label?: string | null; expiryDate?: string | null; notes?: string | null
  } | null
  const key = body?.key
  const type = body?.type || 'otro'
  const label = body?.label || null
  const expiryDate = body?.expiryDate || null
  const notes = body?.notes || null
  if (!key) return NextResponse.json({ error: 'Falta la key del archivo' }, { status: 400 })
  // La key debe caer bajo la carpeta esperada del técnico — nunca confiar en
  // una key arbitraria del cliente para el registro final (mismo criterio
  // que /api/tickets/[id]/documents).
  if (!key.startsWith(`technicians/${techId}/`)) return NextResponse.json({ error: 'Key inválida' }, { status: 400 })

  const doc = await prisma.technicianDocument.create({
    data: {
      technicianId: techId,
      type: type as DocType,
      label,
      fileUrl: key,
      expiryDate: fromDateInput(expiryDate),
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
