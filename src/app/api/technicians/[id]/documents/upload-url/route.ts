import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessTenant } from '@/lib/tenant'
import { getPresignedUploadUrl } from '@/lib/r2'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024

/**
 * POST /api/technicians/[id]/documents/upload-url — primer paso de la
 * subida en 2 pasos. Bug real reportado en vivo: contrato/carnet frontal/
 * reverso subían el archivo completo por esta función serverless
 * (req.formData() en el POST original) y fallaban con "Unexpected token…
 * is not valid JSON" -- el cuerpo de la respuesta de error del límite de
 * payload de la plataforma no es JSON, así que res.json() explota. Mismo
 * bug class ya cerrado para tickets/informes/portal (GAP_REGISTER G63),
 * nunca migrado acá porque no era parte de esos 3 flujos reportados en su
 * momento. Este endpoint solo valida y emite una URL prefirmada de R2; el
 * navegador sube los bytes directo al bucket (uploadDirect), y recién
 * después llama a POST /api/technicians/[id]/documents (sin /upload-url)
 * para registrar el documento ya subido. Mismos chequeos de
 * auth/tenant que antes tenía el POST original -- nada se relaja.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: techId } = await params
  const tech = await prisma.technician.findUnique({ where: { id: techId }, select: { tenantId: true } })
  if (!tech || !canAccessTenant(session.user, tech.tenantId)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => null) as { filename?: string; contentType?: string; size?: number } | null
  const filename = body?.filename
  if (!filename) return NextResponse.json({ error: 'Falta el nombre del archivo' }, { status: 400 })
  const contentType = body?.contentType || 'application/octet-stream'
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: 'Solo PDF, JPG o PNG' }, { status: 415 })
  }
  if (typeof body?.size === 'number' && body.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo mayor a 10 MB' }, { status: 413 })
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin'
  const key = `technicians/${techId}/${Date.now()}-${randomUUID()}.${ext}`
  const uploadUrl = await getPresignedUploadUrl(key, contentType)

  return NextResponse.json({ uploadUrl, key, contentType })
}
