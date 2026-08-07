import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { buildZipFromBuffers } from '@/lib/zip'
import { generateQuotePdf } from '@/lib/quotes/pdf'
import { quoteDataSchema } from '@/lib/quotes/types'
import { buildDownloadFilename } from '@/lib/tickets/file-naming'

export const runtime = 'nodejs'
// Mismo motivo que /api/quotes/generate (G59): varios renders de Chromium
// en la misma request, cold start real.
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'super' && session.user.role !== 'supervisor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as { ids?: string[] } | null
  const ids = body?.ids ?? []
  if (ids.length === 0) return NextResponse.json({ error: 'Nada seleccionado' }, { status: 400 })

  const actor = { role: session.user.role, tenantId: session.user.tenantId ?? '' }
  const docs = await prisma.clientDocument.findMany({
    where: { id: { in: ids }, type: 'propuesta', ...tenantScope(actor) },
    select: { id: true, dataJson: true, quoteId: true, ticket: { select: { ticketCode: true } } },
  })
  if (docs.length === 0) return NextResponse.json({ error: 'Sin documentos' }, { status: 404 })

  const files: { buffer: Buffer; name: string }[] = []
  const usedNames = new Set<string>()
  for (const doc of docs) {
    if (!doc.dataJson) continue
    // Cada documento se procesa en su propio try/catch: un dataJson malformado
    // (JSON.parse) o un Chromium que revienta en un render puntual
    // (generateQuotePdf) no debe tirar abajo documentos que ya se generaron
    // bien antes en el mismo loop — se omite ese documento y sigue el resto.
    try {
      const parsed = quoteDataSchema.safeParse(JSON.parse(doc.dataJson))
      if (!parsed.success) continue // documento legado sin todos los campos — se omite, no revienta el ZIP entero
      const pdf = await generateQuotePdf(parsed.data)
      let name = buildDownloadFilename({ kind: 'presupuesto', number: doc.quoteId, ticketCode: doc.ticket?.ticketCode })
      let i = 2
      while (usedNames.has(name)) { name = name.replace(/\.pdf$/, ` (${i}).pdf`); i++ }
      usedNames.add(name)
      files.push({ buffer: Buffer.from(pdf), name })
    } catch {
      continue // JSON malformado o falla de render — se omite ese documento, no todo el ZIP
    }
  }
  if (files.length === 0) return NextResponse.json({ error: 'No se pudo generar ningún PDF' }, { status: 500 })

  const zipBuffer = await buildZipFromBuffers(files)
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="Propuestas.zip"' },
  })
}
