import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateQuotePdf } from '@/lib/quotes/pdf'
import { quoteDataSchema, type QuoteData } from '@/lib/quotes/types'
import { contentDispositionHeader } from '@/lib/content-disposition'

// Playwright needs the Node.js runtime (not Edge).
export const runtime = 'nodejs'
// 60s era insuficiente en cold start real (extracción del binario de
// @sparticuz/chromium + lanzamiento + render de una propuesta con varias
// imágenes embebidas en base64) — causa más probable de las descargas que
// "a veces" fallaban en producción sin ningún otro error visible. Vercel
// permite hasta 300s por defecto; 120s da margen real sin acercarse a ese
// techo.
export const maxDuration = 120

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  let quoteData: QuoteData
  if (session.user.role === 'client') {
    // Mismo criterio que /api/reports/generate: el portal nunca manda el
    // contenido de la propuesta directamente, solo un id re-verificado
    // server-side (mismo ownership check que /api/portal/propuestas). Los
    // editores internos (staff) siguen mandando el QuoteData completo en
    // vivo (rama de abajo), sin cambios.
    const idRaw = body && typeof body === 'object' ? (body as Record<string, unknown>).documentId : undefined
    if (typeof idRaw !== 'string' || !idRaw) {
      return NextResponse.json({ error: 'Falta documentId.' }, { status: 400 })
    }
    const clientId = (session.user as { clientId?: string }).clientId
    const doc = await prisma.clientDocument.findFirst({
      where: { id: idRaw, type: 'propuesta', clientId: clientId ?? '__none__' },
      select: { dataJson: true },
    })
    if (!doc?.dataJson) {
      return NextResponse.json({ error: 'Propuesta no encontrada.' }, { status: 404 })
    }
    let rawData: unknown
    try {
      rawData = JSON.parse(doc.dataJson)
    } catch {
      return NextResponse.json({ error: 'Datos de la propuesta corruptos.' }, { status: 422 })
    }
    const parsed = quoteDataSchema.safeParse(rawData)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de cotización inválidos.', issues: parsed.error.flatten() },
        { status: 422 },
      )
    }
    quoteData = parsed.data
  } else {
    const parsed = quoteDataSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de cotización inválidos.', issues: parsed.error.flatten() },
        { status: 422 },
      )
    }
    quoteData = parsed.data
  }

  try {
    const pdf = await generateQuotePdf(quoteData)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionHeader('inline', `${quoteData.quoteId}.pdf`),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
    // Surface the real error so we can diagnose serverless Chromium issues from
    // the client (Network tab) without digging through hosting logs.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json({ error: 'No se pudo generar el PDF.', detail }, { status: 500 })
  }
}
