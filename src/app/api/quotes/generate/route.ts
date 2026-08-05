import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateQuotePdf } from '@/lib/quotes/pdf'
import { quoteDataSchema } from '@/lib/quotes/types'
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

  const parsed = quoteDataSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos de cotización inválidos.', issues: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const pdf = await generateQuotePdf(parsed.data)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionHeader('inline', `${parsed.data.quoteId}.pdf`),
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
