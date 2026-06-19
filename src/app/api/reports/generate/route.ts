import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateReportPdf } from '@/lib/reports/pdf'
import { reportDataSchema, reportFilename } from '@/lib/reports/types'

// Playwright needs the Node.js runtime (not Edge).
export const runtime = 'nodejs'
export const maxDuration = 60

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

  const parsed = reportDataSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos del informe inválidos.', issues: parsed.error.flatten() },
      { status: 422 },
    )
  }

  try {
    const pdf = await generateReportPdf(parsed.data)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${reportFilename(parsed.data)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Report PDF generation failed:', err)
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json({ error: 'No se pudo generar el PDF.', detail }, { status: 500 })
  }
}
