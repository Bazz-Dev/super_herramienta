import Link from 'next/link'
import { Suspense } from 'react'
import { requireActor, tenantScope } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { buttonClass } from '@/components/ui/button'
import { LegacyTriage } from '@/components/cashflow/legacy-triage'
import { UnmarkLegacyButton } from '@/components/cashflow/unmark-legacy-button'
import { jobDueDateV2, jobInstallmentsSummary, isOverdueV2, isPaidJob, hasPurchaseOrder, hasInvoiceInfo } from '@/lib/cashflow/job-presets'
import { financialState, FINANCIAL_LABEL, FINANCIAL_COLOR, type FinancialState } from '@/lib/tickets/ticket-state-summary'
import { PROCESS_FLOW_LABELS, PROCESS_FLOW_COLORS } from '@/lib/cashflow/labels'
import { DocStatusIcon, DocIcon, PhotoIcon, OtIcon, ReceiptIcon } from '@/components/cashflow/doc-status-icon'
import { FacturaSearchFilter } from '@/components/cashflow/factura-search-filter'

export const metadata = { title: 'Conciliación — INGEGAR' }

type EstadoConciliacion = 'VINCULADO' | 'SIN_TICKET' | 'SIN_OT' | 'SIN_IT' | 'LEGADO'

const ESTADO_LABEL: Record<EstadoConciliacion, string> = {
  VINCULADO: 'Vinculado',
  SIN_TICKET: 'Sin ticket',
  SIN_OT: 'Sin OT',
  SIN_IT: 'Sin IT',
  LEGADO: 'Legado (revisado)',
}
const ESTADO_BADGE: Record<EstadoConciliacion, string> = {
  VINCULADO: 'bg-ok-100 text-ok-700',
  SIN_TICKET: 'bg-danger-100 text-danger-700',
  SIN_OT: 'bg-warn-100 text-warn-700',
  SIN_IT: 'bg-warn-100 text-warn-700',
  LEGADO: 'bg-gray-100 text-gray-500',
}

const PAGE_SIZE = 30

// Vista de reconciliación Ticket <-> Flujo de Caja <-> OT/IT. No es un
// modelo nuevo — junta Job + su Ticket de origen (originTicketId, el mismo
// mecanismo que ya usa /tickets/[id]) y compara contra ClientDocument
// (type=informe) y Ticket.otFileUrl reales. Ver
// scripts/reconcile-2026-final-report.ts para la misma lógica en batch.
//
// Dos pestañas (2026-08-02, informe #4/#9): "Conciliación" es el día a día
// (todos los estados). "Triage legado" es un espacio de trabajo separado
// para el backlog real del modelo anterior — 328 de 386 trabajos sin ticket
// al momento de escribir esto (script scripts/check-ticket-doc-linking.ts) —
// pensado para resolver de a muchos, no fila por fila. Un trabajo marcado
// `legacyNoTicket` deja de contar como pendiente sin forzar un ticket falso.
export default async function ConciliacionPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; estado?: string; fin?: string; factura?: string; page?: string; tab?: string }>
}) {
  const actor = await requireActor(['super', 'supervisor'])
  const { cliente, estado, fin, factura, page: pageParam, tab: tabParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const tab = tabParam === 'legado' ? 'legado' : 'activo'

  const [clients, jobs, reportedTicketIdsRaw, ticketsForTriage] = await Promise.all([
    prisma.client.findMany({ where: tenantScope(actor), select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.job.findMany({
      where: { ...tenantScope(actor), ...(cliente ? { clientId: cliente } : {}) },
      select: {
        id: true, code: true, description: true, netAmount: true, docReport: true, executionDate: true,
        legacyNoTicket: true, legacyReviewedAt: true, legacyReviewedBy: { select: { name: true } },
        client: { select: { id: true, name: true } }, branch: { select: { name: true } },
        originTicketId: true, originTicket: { select: { id: true, ticketCode: true, otFileUrl: true, processFlow: true } },
        // Estado financiero (informe #9, tablero maestro) — mismos campos que
        // financialState()/job-presets.ts ya usan en /tickets/[id] y /flujo,
        // una sola definición de "vencida"/"pagada"/etc. (informe #25).
        financialStage: true, commercialStage: true, operationalStage: true, nonBillable: true,
        purchaseOrder: true, purchaseOrderStatus: true, invoiceNumber: true, invoiceDate: true, invoiceStatus: true, creditDays: true,
        paymentDate: true, paymentAmount: true, status: true, collectionStatus: true,
        installments: { select: { netAmount: true, purchaseOrder: true, purchaseOrderStatus: true, invoiceNumber: true, invoiceDate: true, invoiceStatus: true, creditDays: true, paymentDate: true, paymentAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.clientDocument.findMany({ where: { type: 'informe', ticketId: { not: null } }, select: { ticketId: true } }),
    // Solo se usa en la pestaña "Triage legado" — se pide siempre igual
    // (barato, ~cientos de filas) para no bifurcar el Promise.all por tab.
    prisma.ticket.findMany({
      where: { ...tenantScope(actor), deletedAt: null, status: { notIn: ['cancelado', 'fusionado'] } },
      select: { id: true, ticketCode: true, title: true, clientId: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const reportedTicketIds = new Set(reportedTicketIdsRaw.map((d) => d.ticketId))

  // Íconos de estado documental (pedido explícito del dueño) — 3 queries
  // planas filtradas por los ticketId reales de esta página (mismo patrón
  // que reportedTicketIdsRaw arriba), nunca un include anidado por Job — con
  // cientos de filas eso sería N+1. Bucket por ticketId en JS, no en SQL.
  const ticketIdsForDocs = [...new Set(jobs.map((j) => j.originTicketId).filter((id): id is string => !!id))]
  const [ticketDocsRaw, expensesRaw, informesRaw] = await Promise.all([
    prisma.ticketDocument.findMany({
      where: { ticketId: { in: ticketIdsForDocs } },
      select: { id: true, ticketId: true, name: true, fileUrl: true, mimeType: true, uploadedAt: true },
      orderBy: { uploadedAt: 'desc' },
    }),
    prisma.expense.findMany({
      where: { ...tenantScope(actor), ticketId: { in: ticketIdsForDocs }, receiptUrl: { not: null } },
      select: { id: true, ticketId: true, receiptUrl: true, description: true, date: true },
      orderBy: { date: 'desc' },
    }),
    prisma.clientDocument.findMany({
      where: { ...tenantScope(actor), type: 'informe', ticketId: { in: ticketIdsForDocs } },
      select: { id: true, ticketId: true, title: true },
    }),
  ])
  function bucketBy<T extends { ticketId: string | null }>(items: T[]): Map<string, T[]> {
    const m = new Map<string, T[]>()
    for (const it of items) {
      if (!it.ticketId) continue
      if (!m.has(it.ticketId)) m.set(it.ticketId, [])
      m.get(it.ticketId)!.push(it)
    }
    return m
  }
  const photosByTicket = bucketBy(ticketDocsRaw.filter((d) => d.mimeType?.startsWith('image/')))
  const otherDocsByTicket = bucketBy(ticketDocsRaw.filter((d) => !d.mimeType?.startsWith('image/')))
  const receiptsByTicket = bucketBy(expensesRaw.map((e) => ({ ...e, fileUrl: e.receiptUrl! })))
  const informesByTicket = bucketBy(informesRaw)

  const ticketsByClient: Record<string, { id: string; ticketCode: string; title: string }[]> = {}
  for (const t of ticketsForTriage) {
    (ticketsByClient[t.clientId] ??= []).push({ id: t.id, ticketCode: t.ticketCode, title: t.title })
  }

  const now = new Date()
  const rows = jobs.map((j) => {
    const estados: EstadoConciliacion[] = []
    if (j.legacyNoTicket) estados.push('LEGADO')
    else if (!j.originTicketId) estados.push('SIN_TICKET')
    else {
      estados.push('VINCULADO')
      if (!j.originTicket?.otFileUrl) estados.push('SIN_OT')
      if (j.docReport && !reportedTicketIds.has(j.originTicketId)) estados.push('SIN_IT')
    }
    const cuotas = j.installments.length > 0 ? jobInstallmentsSummary(j.installments) : null
    // Un trabajo de pago único no tiene monto parcial (solo Job.paymentDate,
    // sin Job.paymentAmount) — a diferencia de una cuota, el saldo es binario:
    // todo el neto si no está pagado, cero si sí.
    const saldo = cuotas ? cuotas.balance : isPaidJob(j) ? 0 : j.netAmount
    const due = cuotas ? null : jobDueDateV2(j)
    // Facturas reales a mostrar (pedido explícito: "mostrando el número de
    // factura que viene alimentado desde flujo de caja") — nunca inventado,
    // solo lo que ya existe en Job/JobInstallment.
    const facturaNumbers = j.installments.length > 0
      ? j.installments.map((i) => i.invoiceNumber).filter((n): n is string => !!n?.trim())
      : j.invoiceNumber?.trim() ? [j.invoiceNumber] : []
    return {
      job: j,
      estados,
      fin: financialState(j),
      overdue: isOverdueV2(j, now),
      due,
      diasVencimiento: due ? Math.floor((due.getTime() - now.getTime()) / 86_400_000) : null,
      saldo,
      cuotas,
      hasOC: hasPurchaseOrder(j),
      hasFactura: hasInvoiceInfo(j),
      facturaNumbers,
    }
  })

  const counts = { VINCULADO: 0, SIN_TICKET: 0, SIN_OT: 0, SIN_IT: 0, LEGADO: 0 } as Record<EstadoConciliacion, number>
  rows.forEach((r) => r.estados.forEach((e) => counts[e]++))
  const finCounts = { sin_trabajo: 0, sin_oc: 0, pendiente_facturar: 0, facturada: 0, vencida: 0, pagada: 0 } as Record<FinancialState, number>
  rows.forEach((r) => finCounts[r.fin]++)

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (cliente) p.set('cliente', cliente)
    if (estado) p.set('estado', estado)
    if (fin) p.set('fin', fin)
    if (factura) p.set('factura', factura)
    if (tab === 'legado') p.set('tab', 'legado')
    Object.entries(overrides).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    return `/conciliacion?${p.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">← Dashboard</Link>
        <h1 className="text-2xl font-bold">Conciliación</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Compara cada trabajo de Flujo de Caja contra su ticket de origen, y ese ticket contra su OT (orden de
          trabajo firmada) y su informe técnico. Cada fila con un problema tiene una acción directa para resolverlo.
        </p>
      </div>

      <div className="mt-4 flex gap-1 border-b border-gray-200">
        <Link
          href={qs({ tab: undefined, estado: undefined, page: undefined })}
          className={`border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${tab === 'activo' ? 'border-brand text-ink' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Conciliación
        </Link>
        <Link
          href={qs({ tab: 'legado', estado: undefined, page: undefined })}
          className={`border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${tab === 'legado' ? 'border-brand text-ink' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          Triage legado
          {counts.SIN_TICKET > 0 && (
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${tab === 'legado' ? 'bg-brand text-ink' : 'bg-danger-100 text-danger-700'}`}>
              {counts.SIN_TICKET}
            </span>
          )}
        </Link>
      </div>

      <div className="mt-3">
        <Suspense fallback={null}>
          <ClientFilter clients={clients} basePath="/conciliacion" />
        </Suspense>
      </div>

      {tab === 'activo' ? (
        <ActivoTab
          rows={rows} counts={counts} finCounts={finCounts} estado={estado} fin={fin} factura={factura} page={page} qs={qs}
          photosByTicket={photosByTicket} otherDocsByTicket={otherDocsByTicket} receiptsByTicket={receiptsByTicket} informesByTicket={informesByTicket}
        />
      ) : (
        <LegacyTriage
          jobs={rows.filter((r) => r.estados.includes('SIN_TICKET')).map((r) => ({
            id: r.job.id,
            code: r.job.code,
            description: r.job.description,
            clientId: r.job.client.id,
            clientName: r.job.client.name,
            branchName: r.job.branch?.name ?? null,
            netAmount: r.job.netAmount,
            executionDate: r.job.executionDate?.toISOString() ?? null,
          }))}
          ticketsByClient={ticketsByClient}
        />
      )}
    </div>
  )
}

type ActivoRow = {
  job: {
    id: string; code: string | null; description: string; netAmount: number | null
    client: { id: string; name: string }; branch: { name: string } | null
    originTicketId: string | null
    originTicket: { id: string; ticketCode: string; otFileUrl: string | null; processFlow: string | null } | null
    legacyReviewedAt: Date | null; legacyReviewedBy: { name: string } | null
    invoiceNumber: string | null
  }
  estados: EstadoConciliacion[]
  fin: FinancialState
  overdue: boolean
  due: Date | null
  diasVencimiento: number | null
  saldo: number | null
  cuotas: ReturnType<typeof jobInstallmentsSummary> | null
  hasOC: boolean
  hasFactura: boolean
  facturaNumbers: string[]
}

type DocFile = { fileUrl: string; name: string }

function ActivoTab({
  rows, counts, finCounts, estado, fin, factura, page, qs,
  photosByTicket, otherDocsByTicket, receiptsByTicket, informesByTicket,
}: {
  rows: ActivoRow[]
  counts: Record<EstadoConciliacion, number>
  finCounts: Record<FinancialState, number>
  estado: string | undefined
  fin: string | undefined
  factura: string | undefined
  page: number
  qs: (o: Record<string, string | undefined>) => string
  photosByTicket: Map<string, DocFile[]>
  otherDocsByTicket: Map<string, DocFile[]>
  receiptsByTicket: Map<string, { fileUrl: string; description: string | null }[]>
  informesByTicket: Map<string, { id: string; title: string }[]>
}) {
  const filtered = rows
    .filter((r) => !estado || r.estados.includes(estado as EstadoConciliacion))
    .filter((r) => !fin || r.fin === (fin as FinancialState))
    .filter((r) => !factura || r.facturaNumbers.some((n) => n.toLowerCase().includes(factura.toLowerCase())))
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // sin_trabajo no aplica acá — todas las filas de esta pestaña ya tienen Job.
  const FIN_STATES: FinancialState[] = ['sin_oc', 'pendiente_facturar', 'facturada', 'vencida', 'pagada']

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(ESTADO_LABEL) as EstadoConciliacion[]).map((e) => (
          <Link
            key={e}
            href={qs({ estado: estado === e ? undefined : e, page: undefined })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              estado === e ? 'border-brand bg-brand/15 text-ink' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {ESTADO_LABEL[e]}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${estado === e ? 'bg-brand text-ink' : 'bg-gray-100 text-gray-500'}`}>{counts[e]}</span>
          </Link>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {FIN_STATES.map((f) => (
          <Link
            key={f}
            href={qs({ fin: fin === f ? undefined : f, page: undefined })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              fin === f ? 'border-brand bg-brand/15 text-ink' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {FINANCIAL_LABEL[f]}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${fin === f ? 'bg-brand text-ink' : 'bg-gray-100 text-gray-500'}`}>{finCounts[f]}</span>
          </Link>
        ))}
        <Suspense fallback={null}>
          <FacturaSearchFilter />
        </Suspense>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {pageRows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-ink">No hay registros con este filtro</p>
            <p className="mt-1 text-xs text-gray-400">Pruebe otro cliente o estado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Ticket</th>
                <th className="px-4 py-2.5 font-medium">Cliente / sucursal</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-2 py-2.5 font-medium text-center">Doc.</th>
                <th className="px-2 py-2.5 font-medium text-center">Fotos</th>
                <th className="px-2 py-2.5 font-medium text-center">OT</th>
                <th className="px-2 py-2.5 font-medium text-center">Gastos</th>
                <th className="px-4 py-2.5 font-medium">Informe</th>
                <th className="px-4 py-2.5 font-medium">Flujo de Caja</th>
                <th className="px-4 py-2.5 font-medium">PP/ED</th>
                <th className="px-4 py-2.5 font-medium">OC</th>
                <th className="px-4 py-2.5 font-medium">Factura</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Financiero</th>
                <th className="px-4 py-2.5 font-medium">Vence</th>
                <th className="px-4 py-2.5 font-medium text-right">Monto</th>
                <th className="px-4 py-2.5 font-medium text-right">Saldo</th>
                <th className="px-4 py-2.5 font-medium">Acción siguiente</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ job, estados, fin: rowFin, overdue, due, diasVencimiento, saldo, cuotas, hasOC, hasFactura, facturaNumbers }) => {
                const ticketId = job.originTicket?.id
                const processFlow = job.originTicket?.processFlow ?? null
                const informes = ticketId ? informesByTicket.get(ticketId) ?? [] : []
                return (
                <tr key={job.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5">
                    {job.originTicket ? <Link href={`/tickets/${job.originTicket.id}`} className="text-brand hover:underline">{job.originTicket.ticketCode}</Link> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5"><div className="font-medium text-ink">{job.client.name}</div><div className="text-xs text-gray-400">{job.branch?.name ?? 'Sin sucursal'}</div></td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-gray-600">{job.description}</td>
                  {ticketId ? (
                    <>
                      <td className="px-2 py-2.5 text-center">
                        <DocStatusIcon ticketId={ticketId} label="Documentación" icon={<DocIcon />} files={otherDocsByTicket.get(ticketId) ?? []} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <DocStatusIcon ticketId={ticketId} label="Fotografías" icon={<PhotoIcon />} files={photosByTicket.get(ticketId) ?? []} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <DocStatusIcon ticketId={ticketId} label="Orden de trabajo" icon={<OtIcon />} files={job.originTicket?.otFileUrl ? [{ fileUrl: job.originTicket.otFileUrl, name: 'Orden de trabajo' }] : []} />
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <DocStatusIcon
                          ticketId={ticketId} label="Gastos" icon={<ReceiptIcon />} directLink
                          files={(receiptsByTicket.get(ticketId) ?? []).map((r) => ({ fileUrl: r.fileUrl, name: r.description ?? 'Comprobante' }))}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        {informes.length > 0 ? (
                          <Link href={`/informe?docId=${informes[0].id}`} className="text-xs font-semibold text-brand hover:underline">Ver informe →</Link>
                        ) : (
                          <Link href={`/informe?ticketId=${ticketId}`} className="text-xs font-semibold text-gray-400 hover:text-brand hover:underline">+ Crear informe</Link>
                        )}
                      </td>
                    </>
                  ) : (
                    <td className="px-2 py-2.5 text-center text-gray-300" colSpan={5}>—</td>
                  )}
                  <td className="px-4 py-2.5">
                    {job.netAmount ? (
                      <Link href={`/flujo/trabajos/${job.id}`} className="text-sm font-medium text-brand hover:underline tabular-nums">{clp(job.netAmount)}</Link>
                    ) : ticketId ? (
                      <Link href={`/flujo/trabajos/new?ticketId=${ticketId}&cliente=${job.client.id}`} className={buttonClass('secondary', 'sm')}>Valorizar ticket</Link>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {processFlow ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PROCESS_FLOW_COLORS[processFlow] ?? 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                        {PROCESS_FLOW_LABELS[processFlow] ?? processFlow}
                      </span>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/flujo/trabajos/${job.id}`}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${hasOC ? 'bg-ok-100 text-ok-700 hover:bg-ok-100/70' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    >
                      {hasOC ? 'Con OC' : 'Sin OC'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {hasFactura && facturaNumbers.length > 0 ? (
                      <Link href={`/flujo/trabajos/${job.id}${cuotas ? '?section=cuotas' : ''}`} className="text-xs font-medium text-brand hover:underline">
                        {cuotas && cuotas.count > 1 ? `Pago parcial · ${facturaNumbers.join(', ')}` : facturaNumbers[0]}
                      </Link>
                    ) : hasFactura ? (
                      <Link href={`/flujo/trabajos/${job.id}${cuotas ? '?section=cuotas' : ''}`} className="text-xs font-medium text-brand hover:underline">Pago parcial →</Link>
                    ) : (
                      <Link href={`/flujo/trabajos/${job.id}`} className={buttonClass('secondary', 'sm')}>Facturar</Link>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {estados.map((e) => <span key={e} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_BADGE[e]}`}>{ESTADO_LABEL[e]}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${FINANCIAL_COLOR[rowFin]}`}>{FINANCIAL_LABEL[rowFin]}</span>
                      {cuotas && (
                        <Link href={`/flujo/trabajos/${job.id}?section=cuotas`} className="text-[10px] text-gray-400 hover:text-brand hover:underline">
                          {cuotas.count} cuota{cuotas.count !== 1 ? 's' : ''}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 ${overdue ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                    {due ? toDateInput(due) : '—'}
                    {overdue && !cuotas && ' · vencida'}
                    {!overdue && diasVencimiento != null && (
                      <span className="ml-1 text-[10px] text-gray-400">({diasVencimiento} día{diasVencimiento !== 1 ? 's' : ''})</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{job.netAmount ? clp(job.netAmount) : '—'}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${saldo != null && saldo > 0 ? (overdue ? 'text-red-600' : 'text-amber-700') : 'text-gray-400'}`}>
                    {saldo != null ? clp(saldo) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {estados.includes('SIN_TICKET') && (
                      <Link href={`/tickets/new?jobId=${job.id}`} className={buttonClass('secondary', 'sm')}>
                        Crear ticket →
                      </Link>
                    )}
                    {job.originTicketId && (estados.includes('SIN_OT') || estados.includes('SIN_IT')) && (
                      <Link href={`/tickets/${job.originTicketId}`} className={buttonClass('secondary', 'sm')}>
                        {estados.includes('SIN_OT') ? 'Subir OT →' : 'Cargar informe →'}
                      </Link>
                    )}
                    {estados.includes('LEGADO') && (
                      <div className="flex items-center gap-1.5">
                        <UnmarkLegacyButton jobId={job.id} />
                        {job.legacyReviewedBy && (
                          <span className="text-[10px] text-gray-300" title={job.legacyReviewedAt ? new Date(job.legacyReviewedAt).toLocaleString('es-CL') : ''}>
                            · {job.legacyReviewedBy.name}
                          </span>
                        )}
                      </div>
                    )}
                    {estados.length === 1 && estados[0] === 'VINCULADO' && (
                      <span className="text-xs text-gray-300">Completo</span>
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Página {page} de {totalPages} · {filtered.length} registros</span>
          <div className="flex gap-2">
            <Link href={qs({ page: String(Math.max(1, page - 1)) })} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Anterior</Link>
            <Link href={qs({ page: String(Math.min(totalPages, page + 1)) })} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Siguiente</Link>
          </div>
        </div>
      )}
    </>
  )
}
