import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildZipFromR2Keys } from '@/lib/zip'
import { COMPANY_DOC_TYPE_LABELS, type CompanyDocTypeId } from '@/lib/resources/labels'

export const runtime = 'nodejs'

/** GET /api/company-documents/zip — todos los documentos de empresa en un solo ZIP. */
export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'super' && session.user.role !== 'supervisor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const docs = await prisma.companyDocument.findMany({
    where: { tenantId: session.user.tenantId },
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
