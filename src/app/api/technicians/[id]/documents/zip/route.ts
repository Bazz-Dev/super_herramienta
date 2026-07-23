import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canAccessTenant } from '@/lib/tenant'
import { buildZipFromR2Keys } from '@/lib/zip'
import { DOC_TYPE_LABELS, type DocTypeId } from '@/lib/resources/labels'

export const runtime = 'nodejs'

/** GET /api/technicians/[id]/documents/zip — descarga en un solo ZIP todos los
 * documentos del técnico, para acreditarlo ante plataformas de proveedores/
 * clientes que piden esta base documental. Solo staff (super/supervisor). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'super' && session.user.role !== 'supervisor') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id: techId } = await params
  const tech = await prisma.technician.findUnique({ where: { id: techId }, select: { tenantId: true, name: true } })
  if (!tech || !canAccessTenant(session.user, tech.tenantId)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const docs = await prisma.technicianDocument.findMany({
    where: { technicianId: techId },
    select: { type: true, label: true, fileUrl: true },
  })
  if (docs.length === 0) return NextResponse.json({ error: 'Sin documentos' }, { status: 404 })

  const zipBuffer = await buildZipFromR2Keys(
    docs.map((doc) => ({
      key: doc.fileUrl,
      baseName: doc.label || DOC_TYPE_LABELS[doc.type as DocTypeId] || doc.type,
    })),
  )

  const fileName = `Documentos-${tech.name.replace(/[^a-zA-Z0-9]+/g, '-')}.zip`
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
