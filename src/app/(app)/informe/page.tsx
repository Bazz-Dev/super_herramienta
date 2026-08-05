import Link from 'next/link'
import { Suspense } from 'react'
import { ReportEditor } from '@/components/reports/report-editor'
import { sampleReport } from '@/lib/reports/sample'
import { requireActor, tenantScope } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { reportDataSchema, type ReportData } from '@/lib/reports/types'
import { Button } from '@/components/ui/button'
import { Table, THead, TBody, Tr, Th, Td, TableEmptyRow } from '@/components/ui/table'
import { FilterBar, FilterPill, FilterClear } from '@/components/ui/filter-bar'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { DateRangeFilter } from '@/components/cashflow/date-range-filter'
import { PROCESS_FLOW_LABELS, PROCESS_FLOW_COLORS } from '@/lib/cashflow/labels'
import { DocumentQuickPreview } from '@/components/quotes/document-quick-preview'

interface Props {
  searchParams: Promise<{
    docId?: string; ticketId?: string; new?: string
    cliente?: string; ticket?: string; desde?: string; hasta?: string; page?: string
  }>
}

const PAGE_SIZE = 24

// Mismo patrón dual-mode que /cotizador (G57 informe #2): bare /informe =
// listado; ?new=1 o ?ticketId= (deep-link "+ Crear informe" desde el
// ticket, ya usado en 6 lugares del repo) = editor en blanco; ?docId= =
// editar existente. ticketId entra directo al modo editor sin exigir
// también new=1 — a diferencia de cotizador, acá los call sites existentes
// (tickets/[id], conciliación, flujo/trabajos/[id], job-document-slots)
// nunca combinan ticketId con new=1, y tratarlos como "listado" rompería
// los 6 de una.
export default async function InformePage({ searchParams }: Props) {
  const actor = await requireActor()
  const sp = await searchParams

  if (sp.docId || sp.new === '1' || sp.ticketId) {
    return <InformeEditor actor={actor} docId={sp.docId} ticketId={sp.ticketId} />
  }

  const page = Math.max(1, Number(sp.page) || 1)
  const where = {
    ...tenantScope(actor),
    type: 'informe' as const,
    ...(sp.cliente ? { clientId: sp.cliente } : {}),
    ...(sp.ticket === 'sin' ? { ticketId: null } : sp.ticket === 'con' ? { ticketId: { not: null } } : {}),
    ...((sp.desde || sp.hasta) ? {
      createdAt: {
        ...(sp.desde ? { gte: new Date(sp.desde) } : {}),
        ...(sp.hasta ? { lte: new Date(`${sp.hasta}T23:59:59`) } : {}),
      },
    } : {}),
  }

  const [total, docs, clients] = await Promise.all([
    prisma.clientDocument.count({ where }),
    prisma.clientDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, title: true, createdAt: true,
        client: { select: { id: true, name: true } },
        ticket: { select: { id: true, ticketCode: true, processFlow: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.client.findMany({ where: tenantScope(actor), select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (sp.cliente) p.set('cliente', sp.cliente)
    if (sp.ticket) p.set('ticket', sp.ticket)
    if (sp.desde) p.set('desde', sp.desde)
    if (sp.hasta) p.set('hasta', sp.hasta)
    Object.entries(overrides).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    return `/informe?${p.toString()}`
  }
  const hasFilters = !!(sp.cliente || sp.ticket || sp.desde || sp.hasta)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Informes</h1>
          <p className="mt-1 text-sm text-gray-500">Todos los informes técnicos creados, en orden cronológico.</p>
        </div>
        <Button href="/informe?new=1" size="sm">+ Crear nueva</Button>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <FilterBar action={hasFilters ? <FilterClear href="/informe" /> : undefined}>
          <Suspense fallback={null}>
            <ClientFilter clients={clients} basePath="/informe" />
          </Suspense>
          <FilterPill
            active={sp.ticket === 'sin'}
            href={qs({ ticket: sp.ticket === 'sin' ? undefined : 'sin', page: undefined })}
            tone="warn"
          >
            Sin ticket
          </FilterPill>
        </FilterBar>
        <Suspense fallback={null}>
          <DateRangeFilter basePath="/informe" desde={sp.desde} hasta={sp.hasta} />
        </Suspense>
      </div>

      <Table>
        <THead>
          <Tr>
            <Th>Informe</Th>
            <Th>Cliente</Th>
            <Th>Ticket</Th>
            <Th>PP/ED</Th>
            <Th>Creado</Th>
            <Th>Por</Th>
          </Tr>
        </THead>
        <TBody>
          {docs.length === 0 ? (
            <TableEmptyRow colSpan={6}>
              {hasFilters ? 'Sin resultados para estos filtros' : 'Sin informes creados todavía'}
            </TableEmptyRow>
          ) : (
            docs.map(d => (
              <Tr key={d.id}>
                <Td>
                  <DocumentQuickPreview docId={d.id} title={d.title} documentType="informe" editHref={`/informe?docId=${d.id}`} />
                </Td>
                <Td>{d.client.name}</Td>
                <Td>
                  {d.ticket ? (
                    <Link href={`/tickets/${d.ticket.id}`} className="text-brand hover:underline">{d.ticket.ticketCode}</Link>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td>
                  {d.ticket?.processFlow ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PROCESS_FLOW_COLORS[d.ticket.processFlow] ?? 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                      {PROCESS_FLOW_LABELS[d.ticket.processFlow] ?? d.ticket.processFlow}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td className="text-gray-500">{d.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</Td>
                <Td className="text-gray-500">{d.createdBy?.name ?? '—'}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Página {page} de {totalPages} · {total} informes</span>
          <div className="flex gap-2">
            <Link href={qs({ page: String(Math.max(1, page - 1)) })} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Anterior</Link>
            <Link href={qs({ page: String(Math.min(totalPages, page + 1)) })} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Siguiente</Link>
          </div>
        </div>
      )}
    </div>
  )
}

async function InformeEditor({ actor, docId, ticketId }: { actor: Awaited<ReturnType<typeof requireActor>>; docId?: string; ticketId?: string }) {
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
        <Link href="/informe" className="text-xs text-gray-400 hover:text-gray-600 mt-1">← Ver todos los informes</Link>
      </div>
      <ReportEditor initial={initialData} clients={clients} tickets={ticketOptions} docId={docId} ticketId={ticketId ?? savedDoc?.ticketId ?? undefined} />
    </div>
  )
}
