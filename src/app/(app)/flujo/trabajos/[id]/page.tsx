import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { getJob, listBranches } from '@/lib/cashflow/queries'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { clp } from '@/lib/cashflow/format'
import { jobTotal, jobDirectCostAndMargin } from '@/lib/cashflow/metrics'
import { JobForm } from '@/components/cashflow/job-form'
import { CostList } from '@/components/cashflow/cost-list'
import { JobDocumentsGrid } from '@/components/cashflow/job-document-slots'
import { InstallmentList } from '@/components/cashflow/installment-list'
import { jobInstallmentsSummary } from '@/lib/cashflow/job-presets'
import { FinancialStageChip } from '@/components/cashflow/job-status-chips'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { DeleteButton } from '@/components/resources/delete-button'
import { AutoFilledBadge } from '@/components/ui/auto-filled-badge'
import { updateJob, deleteJob } from '../../actions'

const DOC_TYPE: Record<string, { label: string; badge: string }> = {
  propuesta: { label: 'Propuesta', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  informe:   { label: 'Informe',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  otro:      { label: 'Otro',      badge: 'bg-gray-100 text-gray-600 border-gray-200' },
}

// Ficha completa — ver docs de la spec "Cambio 3": el resumen superior se
// redujo a lo mínimo (antes duplicaba 12 campos en modo solo-lectura Y
// editable más abajo, en 2 lugares distintos de la misma página) y todos
// los campos editables + costos + documentos + historial viven en 6
// secciones plegables, ninguno removido, solo "Datos del trabajo" abierta
// por defecto. ?section=<slug> permite deep-link desde una alerta.
export default async function TrabajoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ section?: string }>
}) {
  const actor = await requireActor()
  const { id } = await params
  const { section } = await searchParams

  const job = await getJob(actor, id)
  if (!job) notFound()

  const [branches, technicianRows, clientDocs, directExpenses] = await Promise.all([
    listBranches(actor, job.clientId),
    prisma.technician.findMany({
      where: { ...tenantScope(actor), active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    // Documentos de ESTE trabajo, no la carpeta completa del cliente — antes
    // mostraba todos los informes/propuestas del cliente sin importar a qué
    // ticket pertenecían, mezclando trabajos no relacionados. Se acota a los
    // dos vínculos reales que Job ya tiene: el ticket de origen (los
    // informes técnicos se cargan contra el ticket) y la propuesta de
    // origen (si el trabajo nació de una cotización específica).
    job.originTicketId || job.originProposalId
      ? prisma.clientDocument.findMany({
          where: {
            ...tenantScope(actor),
            OR: [
              ...(job.originTicketId ? [{ ticketId: job.originTicketId }] : []),
              ...(job.originProposalId ? [{ id: job.originProposalId }] : []),
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, title: true, type: true, createdAt: true },
        })
      : Promise.resolve([]),
    // Gastos de técnico vinculados directamente a este trabajo (informe #14)
    // — vía jobId explícito, nunca por ticketId solo (un ticket puede tener
    // varios Job, ver Expense.jobId en el schema).
    prisma.expense.findMany({
      where: { jobId: id, ...tenantScope(actor) },
      select: { amount: true, status: true },
    }),
  ])

  const total = jobTotal(job)
  const { jobCostTotal, expenseTotal, directCost, margin, marginPct } = jobDirectCostAndMargin(job, directExpenses)
  const informeDoc = clientDocs.find((d) => d.type === 'informe')

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back link */}
      <Link href="/flujo" className="text-xs text-gray-400 hover:text-gray-600">
        ← Flujo
      </Link>

      {/* Origin ticket banner */}
      {job.originTicket && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M6 5v3M6 10v1"/></svg>
          <span>Creado desde ticket{' '}
            <Link href={`/tickets/${job.originTicket.id}`} className="font-semibold hover:underline">
              {job.originTicket.ticketCode}
            </Link>
            {' '}— {job.originTicket.title}
          </span>
        </div>
      )}

      {/* Origen: registro importado desde el Excel histórico de reconciliación */}
      {job.importRef && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <AutoFilledBadge reason={`Origen del registro: ${job.importRef}`} />
          Este trabajo se cargó desde la importación histórica, no fue creado a mano — algunos datos pueden venir tal cual del Excel original.
        </div>
      )}

      {/* Resumen — reducido a título/cliente-sucursal/código/fecha/estado
          financiero/total. El resto (12 campos que antes vivían acá en
          modo solo-lectura, duplicados con el formulario de abajo) ahora
          se edita directo en su sección correspondiente. */}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{job.description}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{job.branch.name} · {job.client.name}</p>
        </div>
        <FinancialStageChip value={job.financialStage} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
        <span>Código: <span className="font-medium text-ink">{job.code ?? '—'}</span></span>
        <span>{job.executionDate ? job.executionDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha de ejecución'}</span>
        <strong className="text-base font-extrabold tabular-nums text-ink">{clp(total)}</strong>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {/* Secciones 1-3: datos del trabajo / cobros y pago / estados y
            seguimiento — todas dentro del mismo <form>, ver JobForm. */}
        <JobForm
          action={updateJob.bind(null, job.id)}
          branches={branches}
          technicians={technicianRows}
          clientId={job.clientId}
          initial={job}
          openSection={section}
        />

        {/* 4. Costos del trabajo */}
        <CollapsibleSection
          title="Costos del trabajo"
          forceOpen={section === 'costos'}
          summary={`${job.costs.length} costo${job.costs.length === 1 ? '' : 's'} · Margen: ${margin != null ? clp(margin) : '—'}`}
        >
          <CostList costs={job.costs} jobId={job.id} netAmount={job.netAmount} />

          {/* Costo directo real = costos del trabajo + gastos de técnico
              vinculados (informe #14) — desglosado, no un solo número
              ciego, para que se note si algo quedó cargado dos veces
              (ej. una boleta que además se tipeó como costo manual). */}
          {(job.costs.length > 0 || directExpenses.length > 0) && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
              <p className="mb-1.5 font-semibold uppercase tracking-wide text-gray-500">Costo directo y margen real</p>
              <div className="space-y-0.5 text-gray-600">
                <div className="flex justify-between"><span>Costos del trabajo (arriba)</span><span className="tabular-nums">{clp(jobCostTotal)}</span></div>
                <div className="flex justify-between">
                  <span>Gastos de técnico vinculados (aprobados/pagados)</span>
                  <span className="tabular-nums">{clp(expenseTotal)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-gray-300 pt-1 font-semibold text-ink">
                  <span>Costo directo total</span><span className="tabular-nums">{clp(directCost)}</span>
                </div>
                <div className="flex justify-between font-semibold text-ink">
                  <span>Margen bruto</span>
                  <span className="tabular-nums">{margin != null ? `${clp(margin)}${marginPct != null ? ` (${Math.round(marginPct * 100)}%)` : ''}` : '—'}</span>
                </div>
              </div>
              {directExpenses.length === 0 && (
                <p className="mt-1.5 text-gray-400">Sin gastos de técnico vinculados — vincúlalos desde la ficha del ticket si corresponde.</p>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* 5. Documentos — OC/Factura/OT/Informe (adjuntar/vincular en
            contexto) + la carpeta de propuestas/informes del cliente ya
            soportada. */}
        <CollapsibleSection
          title="Documentos"
          forceOpen={section === 'documentos'}
          summary={`OC: ${job.purchaseOrder || 'Falta'} · Factura: ${job.invoiceNumber || 'Falta'}`}
        >
          <JobDocumentsGrid
            jobId={job.id}
            purchaseOrder={job.purchaseOrder}
            purchaseOrderFileUrl={job.purchaseOrderFileUrl}
            purchaseOrderStatus={job.purchaseOrderStatus}
            invoiceNumber={job.invoiceNumber}
            invoiceFileUrl={job.invoiceFileUrl}
            invoiceStatus={job.invoiceStatus}
            otFileUrl={job.originTicket?.otFileUrl ?? null}
            originTicketId={job.originTicketId}
            informeDocId={informeDoc?.id ?? null}
          />

          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Carpeta del cliente</h3>
              <div className="flex items-center gap-3">
                <Link href="/cotizador" className="text-xs font-semibold text-brand hover:underline">+ Propuesta</Link>
                <Link href="/informe" className="text-xs font-semibold text-brand hover:underline">+ Informe</Link>
                <Link href="/documentos" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Ver carpeta →</Link>
              </div>
            </div>
            {clientDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
                {job.originTicketId || job.originProposalId
                  ? 'Sin documentos vinculados a este trabajo todavía.'
                  : 'Este trabajo no tiene ticket ni propuesta de origen — no hay documentos que vincular automáticamente.'}
                {' '}
                <Link href="/cotizador" className="font-semibold text-brand hover:underline">Crear propuesta →</Link>
                {' '}o{' '}
                <Link href="/informe" className="font-semibold text-brand hover:underline">Crear informe →</Link>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {clientDocs.map((doc, i) => {
                  const cfg = DOC_TYPE[doc.type] ?? DOC_TYPE.otro
                  const editorHref = `/${doc.type === 'propuesta' ? 'cotizador' : 'informe'}?docId=${doc.id}`
                  return (
                    <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${i < clientDocs.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>{cfg.label}</span>
                      <span className="flex-1 truncate text-sm text-gray-800">{doc.title}</span>
                      <span className="shrink-0 text-xs text-gray-400">{doc.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <Link href={editorHref} className="shrink-0 text-xs font-semibold text-brand hover:underline">Editar →</Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* 5b. Cuotas (informe #12) — solo relevante si el trabajo se cobra
            en varias OC/factura separadas; oculta por defecto si no. */}
        <CollapsibleSection
          title="Cuotas"
          forceOpen={section === 'cuotas'}
          summary={
            job.installments.length > 0
              ? `${job.installments.length} cuota${job.installments.length !== 1 ? 's' : ''} · Saldo: ${clp(jobInstallmentsSummary(job.installments).balance)}`
              : job.installmentsPlanned
                ? `0 de ${job.installmentsPlanned} creadas`
                : 'Pago único (sin cuotas)'
          }
        >
          <InstallmentList
            jobId={job.id}
            netAmount={job.netAmount}
            installmentsPlanned={job.installmentsPlanned}
            installments={job.installments}
          />
        </CollapsibleSection>

        {/* 6. Historial y auditoría — solo metadatos reales ya trackeados
            (createdAt/updatedAt/importRef/origen); no se construye un
            subsistema de auditoría nuevo. */}
        <CollapsibleSection
          title="Historial y auditoría"
          forceOpen={section === 'historial'}
          summary={`Creado ${job.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        >
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-gray-500">Creado</dt>
              <dd className="text-ink">{job.createdAt.toLocaleString('es-CL')}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Última actualización</dt>
              <dd className="text-ink">{job.updatedAt.toLocaleString('es-CL')}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Origen</dt>
              <dd className="text-ink">
                {job.importRef ? `Importación histórica (${job.importRef})` : job.originTicket ? `Ticket ${job.originTicket.ticketCode}` : 'Creado manualmente'}
              </dd>
            </div>
            {job.originProposalId && (
              <div>
                <dt className="text-xs font-medium text-gray-500">Propuesta de origen</dt>
                <dd><Link href={`/cotizador?docId=${job.originProposalId}`} className="text-brand hover:underline">Ver propuesta →</Link></dd>
              </div>
            )}
          </dl>
        </CollapsibleSection>
      </div>

      {/* Delete job */}
      <div className="mt-10 border-t border-gray-200 pt-6">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Zona de peligro</h2>
        <DeleteButton
          action={deleteJob.bind(null, job.id)}
          confirmText={`¿Eliminar "${job.description}" y todos sus costos? Esta acción no se puede deshacer.`}
        />
      </div>
    </div>
  )
}
