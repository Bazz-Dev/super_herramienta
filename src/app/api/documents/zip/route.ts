import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildZipFromR2Keys } from '@/lib/zip'
import { DOC_TYPE_LABELS, COMPANY_DOC_TYPE_LABELS, type DocTypeId, type CompanyDocTypeId } from '@/lib/resources/labels'

export const runtime = 'nodejs'

type Ref = { type: 'technician' | 'company'; id: string }

/**
 * POST /api/documents/zip — cross-entity ZIP for the /documentacion view,
 * which lists documents from multiple técnicos + empresa at once. Body:
 * { refs: [{ type: 'technician'|'company', id }, ...] }. POST (not GET
 * with ?ids=) because refs span two tables and can get long. Same
 * super/supervisor gate as the per-entity ZIP routes; reuses buildZipFromR2Keys.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.role !== 'super' && session.user.role !== 'supervisor') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { refs?: Ref[] } | null
  const refs = body?.refs ?? []
  if (refs.length === 0) return NextResponse.json({ error: 'Nada seleccionado' }, { status: 400 })

  const techIds = refs.filter((r) => r.type === 'technician').map((r) => r.id)
  const companyIds = refs.filter((r) => r.type === 'company').map((r) => r.id)
  const isSuper = session.user.role === 'super'

  const [techDocs, companyDocs] = await Promise.all([
    techIds.length
      ? prisma.technicianDocument.findMany({
          where: { id: { in: techIds }, technician: isSuper ? undefined : { tenantId: session.user.tenantId } },
          select: { type: true, label: true, fileUrl: true, technician: { select: { name: true } } },
        })
      : Promise.resolve([]),
    companyIds.length
      ? prisma.companyDocument.findMany({
          where: { id: { in: companyIds }, tenantId: isSuper ? undefined : session.user.tenantId },
          select: { type: true, label: true, fileUrl: true },
        })
      : Promise.resolve([]),
  ])

  if (techDocs.length + companyDocs.length === 0) {
    return NextResponse.json({ error: 'Sin documentos' }, { status: 404 })
  }

  const files = [
    ...techDocs.map((d) => ({
      key: d.fileUrl,
      baseName: `${d.technician.name} - ${d.label || DOC_TYPE_LABELS[d.type as DocTypeId] || d.type}`,
    })),
    ...companyDocs.map((d) => ({
      key: d.fileUrl,
      baseName: d.label || COMPANY_DOC_TYPE_LABELS[d.type as CompanyDocTypeId] || d.type,
    })),
  ]

  const zipBuffer = await buildZipFromR2Keys(files)
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="Documentos.zip"',
    },
  })
}
