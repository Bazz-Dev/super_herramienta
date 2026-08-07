import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildZipFromBuffers } from '@/lib/zip'
import { generateReportPdf } from '@/lib/reports/pdf'
import { reportDataSchema } from '@/lib/reports/types'
import { buildDownloadFilename } from '@/lib/tickets/file-naming'
import { isR2Key, getObjectBuffer } from '@/lib/r2'

export const runtime = 'nodejs'
// Mismo motivo que /api/quotes/zip (G59): varios renders de Chromium en la
// misma request, cold start real.
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null) as { ids?: string[] } | null
  const ids = body?.ids ?? []
  if (ids.length === 0) return NextResponse.json({ error: 'Nada seleccionado' }, { status: 400 })

  const { role, clientId, branchId, isClientAdmin } = session.user
  const isStaff = role === 'super' || role === 'supervisor'

  const docs = await prisma.clientDocument.findMany({
    where: { id: { in: ids }, type: 'informe' },
    select: {
      id: true, clientId: true, dataJson: true, fileKey: true,
      ticket: { select: { ticketCode: true, branchId: true } },
    },
  })

  // Mismo criterio de ownership que /api/portal/informes (P0) + el mismo
  // scoping por sucursal que la página de listado (data.md, G45) --
  // re-verificado acá server-side, nunca se confía en qué ids mandó el
  // cliente (podrían no ser suyos, o de otra sucursal si el usuario está
  // branch-scoped). Ids que no pasan se omiten en silencio, no 403 todo el
  // lote -- mismo criterio tolerante que ya usa este endpoint para
  // documentos legados sin dataJson válido.
  const allowed = docs.filter(d =>
    isStaff || (role === 'client' && !!clientId && d.clientId === clientId &&
      (isClientAdmin || !branchId || d.ticket?.branchId === branchId)),
  )
  if (allowed.length === 0) return NextResponse.json({ error: 'Sin documentos' }, { status: 404 })

  const files: { buffer: Buffer; name: string }[] = []
  const usedNames = new Set<string>()
  for (const doc of allowed) {
    // Cada documento en su propio try/catch: uno malformado o que falla al
    // renderizar no debe tirar abajo los que ya se generaron bien antes en
    // el mismo loop -- se omite ese documento y sigue el resto.
    try {
      let buffer: Buffer
      let reportId: string | undefined
      if (!doc.dataJson) {
        if (!isR2Key(doc.fileKey)) continue // "inline" sin dataJson -- nada que incluir
        buffer = await getObjectBuffer(doc.fileKey)
      } else {
        const parsed = reportDataSchema.safeParse(JSON.parse(doc.dataJson))
        if (!parsed.success) continue // legado incompleto -- se omite, no revienta el ZIP entero
        buffer = Buffer.from(await generateReportPdf(parsed.data))
        reportId = parsed.data.reportId
      }
      let name = buildDownloadFilename({ kind: 'informe_tecnico', number: reportId, ticketCode: doc.ticket?.ticketCode })
      let i = 2
      while (usedNames.has(name)) { name = name.replace(/\.pdf$/, ` (${i}).pdf`); i++ }
      usedNames.add(name)
      files.push({ buffer, name })
    } catch {
      continue
    }
  }
  if (files.length === 0) return NextResponse.json({ error: 'No se pudo generar ningún documento' }, { status: 500 })

  const zipBuffer = await buildZipFromBuffers(files)
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="Informes.zip"' },
  })
}
