import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildZipFromR2Keys } from '@/lib/zip'
import { COMPANY_DOC_TYPE_LABELS, type CompanyDocTypeId } from '@/lib/resources/labels'

export const runtime = 'nodejs'

/**
 * GET /api/company-documents/zip — documentos de empresa en un solo ZIP.
 * ?ids=id1,id2 — solo esos documentos (selección desde la página); sin el
 * parámetro, descarga todos (mismo contrato que el ZIP de técnico).
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'super' && session.user.role !== 'supervisor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const idsParam = new URL(req.url).searchParams.get('ids')
  const ids = idsParam ? idsParam.split(',').filter(Boolean) : null

  const docs = await prisma.companyDocument.findMany({
    where: { tenantId: session.user.tenantId, ...(ids ? { id: { in: ids } } : {}) },
    select: { type: true, label: true, fileUrl: true },
  })
  if (docs.length === 0) return NextResponse.json({ error: 'Sin documentos' }, { status: 404 })

  const zipBuffer = await buildZipFromR2Keys(
    docs.map((doc) => ({
      key: doc.fileUrl,
      baseName: doc.label || COMPANY_DOC_TYPE_LABELS[doc.type as CompanyDocTypeId] || doc.type,
    })),
  )

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="Documentos-empresa.zip"',
    },
  })
}
