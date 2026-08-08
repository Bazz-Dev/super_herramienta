import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateReportPdf } from '@/lib/reports/pdf'
import { reportDataSchema, reportFilename, type ReportData } from '@/lib/reports/types'
import { contentDispositionHeader } from '@/lib/content-disposition'

// Playwright needs the Node.js runtime (not Edge).
export const runtime = 'nodejs'
// Mismo ajuste que quotes/generate: 60s era insuficiente bajo cold start
// real en serverless (chromium + render con fotos embebidas), causa más
// probable de descargas que fallaban sin error visible.
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

  let reportData: ReportData
  const idRaw = body && typeof body === 'object' ? (body as Record<string, unknown>).documentId : undefined
  // La rama correcta se decide por LA FORMA del pedido (¿trae documentId, o
  // un ReportData completo?), no por el rol de quien llama. Antes se
  // decidía por session.user.role === 'client' -- pero resolveInformeUrl()
  // (portal-informe-btn.tsx/portal-informe-list.tsx) SIEMPRE manda
  // { documentId }, sin importar si quien mira el portal es un cliente real
  // o un staff usando "ver como"/preview de portal (role=super/supervisor,
  // canViewPortal() en portal-auth.ts). Un staff previsualizando un informe
  // real caía en la rama de abajo, que espera un ReportData completo en el
  // body -- devolvía 422 "reportId/date/client: expected string, received
  // undefined" para CUALQUIER informe, reproduciendo exactamente el bug
  // reportado ("el botón Ver del informe no funciona"). Los editores
  // internos (staff) para un borrador sin guardar siguen mandando el
  // ReportData completo en vivo (rama de abajo) -- esa es la única llamada
  // real que no trae documentId.
  if (typeof idRaw === 'string' && idRaw) {
    // El portal (y el preview de staff) nunca mandan el contenido del
    // informe directamente -- solo un id, que se re-verifica y re-deriva
    // acá server-side (mismo chequeo de ownership que /api/portal/informes).
    // Antes este endpoint aceptaba cualquier ReportData que el body trajera
    // sin validar dueño alguno -- un cliente autenticado podía en teoría
    // pedir el render de datos que no le pertenecen.
    const role = session.user.role
    const clientId = (session.user as { clientId?: string }).clientId
    const allowed = role === 'super' || role === 'supervisor' || (role === 'client' && !!clientId)
    if (!allowed) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
    }
    const doc = await prisma.clientDocument.findFirst({
      where: {
        id: idRaw, type: 'informe',
        ...(role === 'client' ? { clientId: clientId ?? '__none__' } : {}),
      },
      select: { dataJson: true },
    })
    if (!doc?.dataJson) {
      return NextResponse.json({ error: 'Informe no encontrado.' }, { status: 404 })
    }
    let rawData: unknown
    try {
      rawData = JSON.parse(doc.dataJson)
    } catch {
      return NextResponse.json({ error: 'Datos del informe corruptos.' }, { status: 422 })
    }
    const parsed = reportDataSchema.safeParse(rawData)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos del informe inválidos.', issues: parsed.error.flatten() },
        { status: 422 },
      )
    }
    reportData = parsed.data
  } else {
    const parsed = reportDataSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos del informe inválidos.', issues: parsed.error.flatten() },
        { status: 422 },
      )
    }
    reportData = parsed.data
  }

  try {
    const pdf = await generateReportPdf(reportData)
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionHeader('inline', `${reportFilename(reportData)}.pdf`),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Report PDF generation failed:', err)
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return NextResponse.json({ error: 'No se pudo generar el PDF.', detail }, { status: 500 })
  }
}
