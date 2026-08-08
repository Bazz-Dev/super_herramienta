import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPresignedUrl, getObjectBuffer, isR2Key, objectExists } from '@/lib/r2'
import { ticketFileFilter } from '@/lib/files-access'
import { contentDispositionHeader } from '@/lib/content-disposition'

export const runtime = 'nodejs'

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
}

type FileType = 'ticket' | 'technician' | 'company' | 'job' | 'client-editor' | 'client-document'

/** Shared by GET and HEAD — validates the caller owns access to the resource
 * that contains this key. Returns the error response to send, or null if access is granted. */
async function verifyAccess(
  key: string,
  type: FileType,
  user: { tenantId: string; role: string; id: string; clientId?: string | null },
): Promise<NextResponse | null> {
  const { tenantId, role } = user
  if (type === 'client-editor') {
    // Fotos/OT recién subidas desde el editor de Informe Técnico — todavía no
    // son un ClientDocument (eso ocurre recién al "Guardar en cliente"), así
    // que no hay fila de dueño que verificar; el gate es el mismo que ya usa
    // /api/client-documents y /api/client-documents/upload-url para esta
    // función (staff del tenant, sin excepción por cliente puntual).
    if (role !== 'super' && role !== 'supervisor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return null
  }
  if (type === 'ticket') {
    const ticketFilter = ticketFileFilter(role, tenantId, user.id, user.clientId)
    const doc = await prisma.ticketDocument.findFirst({ where: { fileUrl: key, ticket: ticketFilter }, select: { id: true } })
    if (doc) return null
    // Bug real reportado en vivo: la OT (Ticket.otFileUrl) vive en un campo
    // directo del ticket, no en TicketDocument -- este chequeo nunca la
    // encontraba, así que el visor de OT mostraba "Documento no disponible"
    // siempre, aunque el archivo existiera. Mismo scoping por rol que arriba.
    const ticket = await prisma.ticket.findFirst({ where: { otFileUrl: key, ...ticketFilter }, select: { id: true } })
    return ticket ? null : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (type === 'client-document') {
    // Informes/propuestas subidos como archivo real (sin dataJson) -- mismo
    // criterio de ownership que /api/portal/informes y /api/portal/propuestas.
    const doc = await prisma.clientDocument.findFirst({
      where: { fileKey: key, ...(role === 'client' ? { clientId: user.clientId ?? '__none__' } : role === 'super' ? {} : { tenantId }) },
      select: { id: true },
    })
    return doc ? null : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (type === 'technician') {
    const doc = await prisma.technicianDocument.findFirst({
      where: { fileUrl: key, technician: role === 'super' ? undefined : { tenantId } },
      select: { id: true },
    })
    return doc ? null : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (type === 'company') {
    const doc = await prisma.companyDocument.findFirst({ where: { fileUrl: key, tenantId: role === 'super' ? undefined : tenantId }, select: { id: true } })
    return doc ? null : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (type === 'job') {
    const doc = await prisma.job.findFirst({
      where: { OR: [{ purchaseOrderFileUrl: key }, { invoiceFileUrl: key }], ...(role === 'super' ? {} : { tenantId }) },
      select: { id: true },
    })
    return doc ? null : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

function parseParams(req: NextRequest): { key: string; type: FileType } | NextResponse {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  const type = searchParams.get('type') as FileType | null
  if (!key || !type) return NextResponse.json({ error: 'Missing key or type' }, { status: 400 })
  if (!isR2Key(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
  return { key, type }
}

/**
 * HEAD /api/files?key=...&type=... — bug real reportado en vivo ("el visor
 * de documentos da 404 en algunos lugares, ej. documentos de técnicos"):
 * reproducido contra el espejo local — un `fileUrl` en DB puede apuntar a
 * una key que ya no existe en R2 real (confirmado: el caso puntual
 * reproducido ya no existe en Turso PROD, se autosanó, pero nada impedía que
 * volviera a pasar). Antes, FilePreviewButton apuntaba el <iframe>/<img>
 * directo a la ruta GET, que redirige ciego a R2 — si el objeto no existía,
 * el usuario veía el XML crudo de R2 ("NoSuchKey") dentro del modal. Este
 * HEAD deja que el cliente chequee barato (sin bajar bytes, sin presignar)
 * antes de prometer un preview que va a fallar.
 */
export async function HEAD(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse(null, { status: 401 })

  const parsed = parseParams(req)
  if (parsed instanceof NextResponse) return new NextResponse(null, { status: parsed.status })

  const denied = await verifyAccess(parsed.key, parsed.type, session.user)
  if (denied) return new NextResponse(null, { status: denied.status })

  const exists = await objectExists(parsed.key)
  return new NextResponse(null, { status: exists ? 200 : 404 })
}

/**
 * GET /api/files?key=tickets/abc/file.pdf&type=ticket|technician
 *
 * Validates the caller owns access to the resource that contains this key,
 * then issues a 307 redirect to a 1-hour presigned R2 URL.
 * Never exposes the signed URL to the browser URL bar (redirect, not JSON).
 *
 * &download=1&filename=... — bug real reportado en vivo: el botón
 * "Descargar" de FilePreviewButton hacía `fetch()` sobre esta ruta para
 * armar un blob: URL (mismo patrón que DownloadPdfButton) — pero al ser un
 * redirect 307 a otro origen (R2), el navegador bloquea el fetch por CORS
 * (R2 nunca respondió pensado para ser consumido así, solo navegado/
 * embebido). Con `download=1` esta ruta baja los bytes server-side
 * (mismo `getObjectBuffer` que ya arma los ZIP) y los devuelve directo,
 * mismo origen de punta a punta, sin exponer la URL firmada.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = parseParams(req)
  if (parsed instanceof NextResponse) return parsed
  const { key, type } = parsed

  const denied = await verifyAccess(key, type, session.user)
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  if (searchParams.get('download') === '1') {
    const filename = searchParams.get('filename') || key.split('/').pop() || 'archivo'
    const ext = key.split('.').pop()?.toLowerCase() ?? ''
    try {
      const buffer = await getObjectBuffer(key)
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
          'Content-Disposition': contentDispositionHeader('attachment', filename),
          'Cache-Control': 'no-store',
        },
      })
    } catch {
      return NextResponse.json({ error: 'Archivo no encontrado en almacenamiento' }, { status: 404 })
    }
  }

  // ponytail: sin chequeo de existencia acá — el visor (FilePreviewButton)
  // ya lo hace vía HEAD antes de apuntar el <iframe>/<img> a esta ruta (ver
  // comentario de HEAD arriba); duplicarlo acá solo agregaría latencia al
  // camino de descarga real, que ya venía funcionando bien.
  const url = await getPresignedUrl(key, 3600)
  return NextResponse.redirect(url, 307)
}
