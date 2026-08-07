import Link from 'next/link'
import { Suspense } from 'react'
import { QuoteEditor } from '@/components/quotes/quote-editor'
import { sampleQuote } from '@/lib/quotes/sample'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { quoteDataSchema, computeTotals, type QuoteData } from '@/lib/quotes/types'
import { Button } from '@/components/ui/button'
import { FilterBar, FilterPill, FilterClear } from '@/components/ui/filter-bar'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { BranchFilter } from '@/components/cashflow/branch-filter'
import { DateRangeFilter } from '@/components/cashflow/date-range-filter'
import { PROPOSAL_STATUS_LABELS } from '@/lib/pipeline/labels'
import type { ProposalStatus } from '@/generated/prisma/enums'
import { ProposalsTable } from '@/components/quotes/proposals-table'
import { QuoteNumberFilter } from '@/components/quotes/quote-number-filter'
import { QuoteSequenceConfigButton } from '@/components/quotes/quote-sequence-config-modal'

interface Props {
  searchParams: Promise<{
    docId?: string; ticketId?: string; new?: string
    cliente?: string; estado?: string; ticket?: string; desde?: string; hasta?: string; page?: string
    numero?: string; sucursal?: string
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
    ...(sp.numero ? { quoteId: { contains: sp.numero } } : {}),
    ...(sp.sucursal ? { ticket: { branchId: sp.sucursal } } : {}),
    ...((sp.desde || sp.hasta) ? {
      createdAt: {
        ...(sp.desde ? { gte: new Date(sp.desde) } : {}),
        ...(sp.hasta ? { lte: new Date(`${sp.hasta}T23:59:59`) } : {}),
      },
    } : {}),
  }

  const [total, docs, clients, branches] = await Promise.all([
    prisma.clientDocument.count({ where }),
    prisma.clientDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, title: true, quoteId: true, createdAt: true, proposalStatus: true, proposalAmount: true,
        // dataJson solo para esta página (máx. PAGE_SIZE filas) — resuelve el
        // Monto real cuando proposalAmount todavía no se asignó a mano en
        // Pipeline (bug real reportado: el listado mostraba "—" pese a que
        // el documento sí tiene un total calculado). Nunca se muestra en el
        // listado como texto, solo se usa para computeTotals().
        dataJson: true,
        client: { select: { id: true, name: true } },
        ticket: { select: { id: true, ticketCode: true, processFlow: true, branch: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.client.findMany({ where: tenantScope(actor), select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.branch.findMany({ where: tenantScope(actor), select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Fallback de Monto: proposalAmount es también el monto de Pipeline
  // (editable a mano, decisión ya tomada en G54 — nunca se sobreescribe al
  // guardar, siempre en CLP) — si nadie lo tocó todavía, se muestra el
  // total real calculado del documento, respetando SU moneda (CLP/UF/USD) —
  // formatear un total en UF como si fuera CLP fue un bug real detectado en
  // la propia verificación de este fix (ej. "UF 11,9" mostrándose "$12").
  const docsWithAmount = docs.map((d) => {
    if (d.proposalAmount != null) return { ...d, displayAmount: d.proposalAmount, displayCurrency: 'CLP' as const }
    try {
      const parsed = d.dataJson ? JSON.parse(d.dataJson) : null
      return {
        ...d,
        displayAmount: parsed ? computeTotals(parsed).total : null,
        displayCurrency: (parsed?.currency ?? 'CLP') as 'CLP' | 'UF' | 'USD',
      }
    } catch {
      return { ...d, displayAmount: null, displayCurrency: 'CLP' as const }
    }
  })

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (sp.cliente) p.set('cliente', sp.cliente)
    if (estado) p.set('estado', estado)
    if (sp.ticket) p.set('ticket', sp.ticket)
    if (sp.numero) p.set('numero', sp.numero)
    if (sp.sucursal) p.set('sucursal', sp.sucursal)
    if (sp.desde) p.set('desde', sp.desde)
    if (sp.hasta) p.set('hasta', sp.hasta)
    Object.entries(overrides).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    return `/cotizador?${p.toString()}`
  }
  const hasFilters = !!(sp.cliente || estado || sp.ticket || sp.numero || sp.sucursal || sp.desde || sp.hasta)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Propuestas</h1>
          <p className="mt-1 text-sm text-gray-500">Todas las propuestas comerciales creadas, en orden cronológico.</p>
        </div>
        <div className="flex items-center gap-2">
          {actor.role === 'super' && <QuoteSequenceConfigButton />}
          <Button href="/cotizador?new=1" size="sm">+ Crear nueva</Button>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <FilterBar action={hasFilters ? <FilterClear href="/cotizador" /> : undefined}>
          <Suspense fallback={null}>
            <ClientFilter clients={clients} basePath="/cotizador" />
          </Suspense>
          <Suspense fallback={null}>
            <QuoteNumberFilter basePath="/cotizador" />
          </Suspense>
          <Suspense fallback={null}>
            <BranchFilter branches={branches} basePath="/cotizador" />
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

      <ProposalsTable docs={docsWithAmount} hasFilters={hasFilters} />

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
      select: { dataJson: true, title: true, ticketId: true },
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

  // Bug real reportado en producción: para una propuesta NUEVA, initialData
  // quedaba igual a sampleQuote tal cual -- incluido su quoteId de ejemplo
  // hardcodeado ("ING-MANT-260609-ALCON-001", formato legado, pre-correlativo).
  // El campo de solo lectura hace `data.quoteId ? data.quoteId : 'Se asignará
  // al guardar'` -- como ese string de ejemplo es truthy, el usuario veía ese
  // ID falso como si fuera real en vez del mensaje de pendiente. Esto quedó
  // así desde que Task 3 volvió el campo de solo lectura (antes era un
  // <TextInput> editable que el usuario sobrescribía sin pensarlo dos veces,
  // por eso nunca se notó). quoteId se limpia acá solo para el caso "nuevo"
  // -- un doc ya guardado sigue mostrando su número real vía la rama de abajo.
  let initialData: QuoteData = { ...sampleQuote, quoteId: '' }
  if (savedDoc?.dataJson) {
    try {
      const raw = JSON.parse(savedDoc.dataJson)
      // Sanitize via Zod: catches malformed taxRate (e.g. 19 instead of 0.19),
      // missing fields from older schema versions, and applies current defaults.
      // Si faltan campos obligatorios (client/quoteId/date, un doc realmente
      // legado) el safeParse falla — en ese caso, fusionar sobre los defaults
      // del sample en vez de entregar el objeto crudo tal cual evita que el
      // editor o el renderer exploten con "Cannot read properties of
      // undefined" en un array que el schema espera pero el doc no tiene
      // (mismo bug real encontrado y corregido en informe/page.tsx).
      const result = quoteDataSchema.safeParse(raw)
      initialData = result.success ? result.data : { ...sampleQuote, ...raw }
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
      <QuoteEditor initial={initialData} clients={clients} tickets={ticketOptions} docId={docId} ticketId={ticketId ?? savedDoc?.ticketId ?? undefined} />
    </div>
  )
}
