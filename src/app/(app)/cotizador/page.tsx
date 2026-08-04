import Link from 'next/link'
import { Suspense } from 'react'
import { QuoteEditor } from '@/components/quotes/quote-editor'
import { sampleQuote } from '@/lib/quotes/sample'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { quoteDataSchema, type QuoteData } from '@/lib/quotes/types'
import { Button } from '@/components/ui/button'
import { Table, THead, TBody, Tr, Th, Td, TableEmptyRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FilterBar, FilterPill, FilterClear } from '@/components/ui/filter-bar'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { DateRangeFilter } from '@/components/cashflow/date-range-filter'
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_BADGE, formatCLP } from '@/lib/pipeline/labels'
import type { ProposalStatus } from '@/generated/prisma/enums'

interface Props {
  searchParams: Promise<{
    docId?: string; ticketId?: string; new?: string
    cliente?: string; estado?: string; ticket?: string; desde?: string; hasta?: string; page?: string
  }>
}

const PAGE_SIZE = 24

export default async function CotizadorPage({ searchParams }: Props) {
  const actor = await requireActor()
  const sp = await searchParams

  if (sp.docId || sp.new === '1') {
    return <CotizadorEditor actor={actor} docId={sp.docId} ticketId={sp.ticketId} />
  }

  const page = Math.max(1, Number(sp.page) || 1)
  // sp.estado viene de la URL (editable a mano) — validar contra el enum real
  // antes de pasarlo a Prisma en vez de castear a ciegas (un valor inválido
  // ahí revienta la query, no solo el filtro visual).
  const estado = sp.estado && sp.estado in PROPOSAL_STATUS_LABELS ? (sp.estado as ProposalStatus) : undefined
  const where = {
    ...tenantScope(actor),
    type: 'propuesta' as const,
    ...(sp.cliente ? { clientId: sp.cliente } : {}),
    ...(estado ? { proposalStatus: estado } : {}),
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
        id: true, title: true, createdAt: true, proposalStatus: true, proposalAmount: true,
        client: { select: { id: true, name: true } },
        ticket: { select: { id: true, ticketCode: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.client.findMany({ where: tenantScope(actor), select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (sp.cliente) p.set('cliente', sp.cliente)
    if (estado) p.set('estado', estado)
    if (sp.ticket) p.set('ticket', sp.ticket)
    if (sp.desde) p.set('desde', sp.desde)
    if (sp.hasta) p.set('hasta', sp.hasta)
    Object.entries(overrides).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    return `/cotizador?${p.toString()}`
  }
  const hasFilters = !!(sp.cliente || estado || sp.ticket || sp.desde || sp.hasta)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Propuestas</h1>
          <p className="mt-1 text-sm text-gray-500">Todas las propuestas comerciales creadas, en orden cronológico.</p>
        </div>
        <Button href="/cotizador?new=1" size="sm">+ Crear nueva</Button>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <FilterBar action={hasFilters ? <FilterClear href="/cotizador" /> : undefined}>
          <Suspense fallback={null}>
            <ClientFilter clients={clients} basePath="/cotizador" />
          </Suspense>
          {(Object.entries(PROPOSAL_STATUS_LABELS) as [ProposalStatus, string][]).map(([value, label]) => (
            <FilterPill
              key={value}
              active={estado === value}
              href={qs({ estado: estado === value ? undefined : value, page: undefined })}
            >
              {label}
            </FilterPill>
          ))}
          <FilterPill
            active={sp.ticket === 'sin'}
            href={qs({ ticket: sp.ticket === 'sin' ? undefined : 'sin', page: undefined })}
            tone="warn"
          >
            Sin ticket
          </FilterPill>
        </FilterBar>
        <Suspense fallback={null}>
          <DateRangeFilter basePath="/cotizador" desde={sp.desde} hasta={sp.hasta} />
        </Suspense>
      </div>

      <Table>
        <THead>
          <Tr>
            <Th>Propuesta</Th>
            <Th>Cliente</Th>
            <Th>Ticket</Th>
            <Th>Estado</Th>
            <Th className="text-right">Monto</Th>
            <Th>Creada</Th>
            <Th>Por</Th>
          </Tr>
        </THead>
        <TBody>
          {docs.length === 0 ? (
            <TableEmptyRow colSpan={7}>
              {hasFilters ? 'Sin resultados para estos filtros' : 'Sin propuestas creadas todavía'}
            </TableEmptyRow>
          ) : (
            docs.map(d => (
              <Tr key={d.id}>
                <Td>
                  <Link href={`/cotizador?docId=${d.id}`} className="font-medium text-brand hover:underline">{d.title}</Link>
                </Td>
                <Td>{d.client.name}</Td>
                <Td>
                  {d.ticket ? (
                    <Link href={`/tickets/${d.ticket.id}`} className="text-brand hover:underline">{d.ticket.ticketCode}</Link>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td>
                  {d.proposalStatus ? (
                    <Badge {...PROPOSAL_STATUS_BADGE[d.proposalStatus]}>{PROPOSAL_STATUS_LABELS[d.proposalStatus]}</Badge>
                  ) : <span className="text-gray-300">—</span>}
                </Td>
                <Td className="text-right tabular-nums">{d.proposalAmount ? formatCLP(d.proposalAmount) : '—'}</Td>
                <Td className="text-gray-500">{d.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</Td>
                <Td className="text-gray-500">{d.createdBy?.name ?? '—'}</Td>
              </Tr>
            ))
          )}
        </TBody>
      </Table>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Página {page} de {totalPages} · {total} propuestas</span>
          <div className="flex gap-2">
            <Link href={qs({ page: String(Math.max(1, page - 1)) })} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Anterior</Link>
            <Link href={qs({ page: String(Math.min(totalPages, page + 1)) })} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Siguiente</Link>
          </div>
        </div>
      )}
    </div>
  )
}

async function CotizadorEditor({ actor, docId, ticketId }: { actor: Awaited<ReturnType<typeof requireActor>>; docId?: string; ticketId?: string }) {
  const [clients, tickets, savedDoc] = await Promise.all([
    prisma.client.findMany({
      where: { ...tenantScope(actor) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.ticket.findMany({
      where: { ...tenantScope(actor), deletedAt: null, status: { notIn: ['cancelado', 'fusionado'] } },
      select: {
        id: true, ticketCode: true, title: true,
        client: { select: { id: true, name: true, rut: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    }),
    docId ? prisma.clientDocument.findFirst({
      where: { id: docId, ...tenantScope(actor), type: 'propuesta' },
      select: { dataJson: true, title: true },
    }) : null,
  ])

  const ticketOptions = tickets.map(t => ({
    id: t.id,
    ticketCode: t.ticketCode,
    title: t.title,
    clientId: t.client.id,
    clientName: t.client.name,
    clientRut: t.client.rut ?? '',
    branchName: t.branch?.name ?? '',
  }))

  let initialData: QuoteData = sampleQuote
  if (savedDoc?.dataJson) {
    try {
      const raw = JSON.parse(savedDoc.dataJson)
      // Sanitize via Zod: catches malformed taxRate (e.g. 19 instead of 0.19),
      // missing fields from older schema versions, and applies current defaults.
      const result = quoteDataSchema.safeParse(raw)
      initialData = result.success ? result.data : (raw as QuoteData)
    } catch { /* keep sampleQuote */ }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generador de Propuesta Técnico Comercial</h1>
          <p className="mt-1 text-sm text-gray-500">
            {savedDoc ? `Editando: ${savedDoc.title}` : 'Edita los datos y descarga el PDF. La vista previa se actualiza en vivo.'}
          </p>
        </div>
        <Link href="/cotizador" className="text-xs text-gray-400 hover:text-gray-600 mt-1">← Ver todas las propuestas</Link>
      </div>
      <QuoteEditor initial={initialData} clients={clients} tickets={ticketOptions} docId={docId} ticketId={ticketId} />
    </div>
  )
}
