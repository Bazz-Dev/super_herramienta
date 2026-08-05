import { ReportEditor } from '@/components/reports/report-editor'
import { sampleReport } from '@/lib/reports/sample'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { reportDataSchema, type ReportData } from '@/lib/reports/types'

interface Props {
  searchParams: Promise<{ docId?: string; ticketId?: string }>
}

export default async function InformePage({ searchParams }: Props) {
  const actor = await requireActor()
  const { docId, ticketId } = await searchParams

  const [clients, tickets, savedDoc, ticketsWithInformeRaw] = await Promise.all([
    prisma.client.findMany({
      where: { ...tenantScope(actor) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.ticket.findMany({
      where: { ...tenantScope(actor), deletedAt: null, status: { notIn: ['cancelado', 'fusionado'] } },
      select: {
        id: true, ticketCode: true, title: true, otNumber: true, otFileUrl: true,
        client: { select: { id: true, name: true } },
        branch: { select: { name: true } },
        // Fotos ya subidas al ticket (cliente al crearlo + técnico al ejecutar) —
        // se re-usan acá para no obligar a subirlas dos veces al armar el informe.
        documents: {
          where: { mimeType: { startsWith: 'image/' } },
          select: { id: true, name: true, fileUrl: true },
          orderBy: { uploadedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    }),
    docId ? prisma.clientDocument.findFirst({
      where: { id: docId, ...tenantScope(actor), type: 'informe' },
      select: { dataJson: true, title: true, ticketId: true },
    }) : null,
    // Tickets que ya tienen al menos un informe — se usa para no ensuciar el
    // desplegable con tickets ya cubiertos (pedido explícito del dueño). Un
    // ticket puede legítimamente tener más de un informe (varias visitas
    // técnicas, ver referencia IT/IT-2 en tickets/[id]/page.tsx) — por eso
    // esto NO bloquea crear un segundo informe, solo deja de sugerirlo por
    // defecto; el entry point "+ Crear informe" de la ficha del ticket sigue
    // funcionando igual porque pasa ?ticketId= explícito (ver excepción abajo).
    prisma.clientDocument.findMany({
      where: { ...tenantScope(actor), type: 'informe', ticketId: { not: null } },
      select: { ticketId: true },
    }),
  ])

  let initialData: ReportData = sampleReport
  if (savedDoc?.dataJson) {
    try {
      const raw = JSON.parse(savedDoc.dataJson)
      // Sanitize via Zod (mismo patrón que cotizador/page.tsx). Bug real
      // encontrado en vivo: un informe legado con dataJson = solo {photos:[]}
      // (le faltan reportId/date/client, campos obligatorios sin default)
      // hace fallar el safeParse — el fallback anterior ("raw as ReportData")
      // entregaba ese objeto crudo tal cual al editor, y CADA componente que
      // asume `sections`/`photos` como array (el renderer Y el formulario,
      // SectionsEditor) explotaba con "Cannot read properties of undefined".
      // Fix real: en vez de "datos crudos o nada", el fallback fusiona sobre
      // los defaults del sample — todo campo ausente en el doc legado queda
      // con un valor seguro, todo campo presente se conserva tal cual.
      const result = reportDataSchema.safeParse(raw)
      initialData = result.success ? result.data : { ...sampleReport, ...raw }
    } catch { /* keep sampleReport */ }
  }

  const ticketsWithInforme = new Set(ticketsWithInformeRaw.map(d => d.ticketId!))
  // Excepciones: el ticket pasado por ?ticketId= (deep-link "+ Crear informe"
  // desde la ficha del ticket) y el ticket del propio doc que se está
  // editando — ninguno de los dos debe desaparecer del desplegable aunque ya
  // tengan un informe.
  const keepEvenWithInforme = new Set([ticketId, savedDoc?.ticketId].filter((v): v is string => !!v))

  const ticketOptions = tickets
    .filter(t => !ticketsWithInforme.has(t.id) || keepEvenWithInforme.has(t.id))
    .map(t => ({
      id: t.id,
      ticketCode: t.ticketCode,
      title: t.title,
      otNumber: t.otNumber,
      otFileUrl: t.otFileUrl,
      clientId: t.client.id,
      clientName: t.client.name,
      branchName: t.branch?.name ?? '',
      photos: t.documents,
    }))

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Creador de Informe Técnico</h1>
          <p className="mt-1 text-sm text-gray-500">
            {savedDoc ? `Editando: ${savedDoc.title}` : 'Vincula un ticket para autocompletar datos, luego edita secciones y registro fotográfico. PDF en A4.'}
          </p>
        </div>
        {savedDoc && (
          <a href="/informe" className="text-xs text-gray-400 hover:text-gray-600 mt-1">+ Nuevo informe</a>
        )}
      </div>
      <ReportEditor initial={initialData} clients={clients} tickets={ticketOptions} docId={docId} ticketId={ticketId ?? savedDoc?.ticketId ?? undefined} />
    </div>
  )
}
