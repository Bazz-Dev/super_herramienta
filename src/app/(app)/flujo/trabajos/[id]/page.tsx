import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireActor } from '@/lib/tenant'
import { getJob, listBranches } from '@/lib/cashflow/queries'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { JOB_TYPE_LABELS, JOB_STATUS_LABELS } from '@/lib/cashflow/labels'
import { clp } from '@/lib/cashflow/format'
import { toDateInput } from '@/lib/cashflow/dates'
import { jobTotal } from '@/lib/cashflow/metrics'
import { CollectionChip } from '@/components/cashflow/collection-chip'
import { JobForm } from '@/components/cashflow/job-form'
import { CostList } from '@/components/cashflow/cost-list'
import { DeleteButton } from '@/components/resources/delete-button'
import { AutoFilledBadge } from '@/components/ui/auto-filled-badge'
import { updateJob, deleteJob } from '../../actions'

const DOC_TYPE: Record<string, { label: string; badge: string }> = {
  propuesta: { label: 'Propuesta', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  informe:   { label: 'Informe',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  otro:      { label: 'Otro',      badge: 'bg-gray-100 text-gray-600 border-gray-200' },
}

function InfoRow({ label, value, autoFilled }: { label: string; value: string; autoFilled?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500">
        {label}
        {autoFilled && <AutoFilledBadge reason={autoFilled} />}
      </span>
      <span className="text-sm text-ink">{value || '—'}</span>
    </div>
  )
}

export default async function TrabajoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireActor()
  const { id } = await params

  const job = await getJob(actor, id)
  if (!job) notFound()

  const [branches, technicianRows, clientDocs] = await Promise.all([
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
  ])

  const total = jobTotal(job)

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back link */}
      <Link href="/flujo/trabajos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Trabajos
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

      {/* Header */}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{job.description}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{job.branch.name} · {job.client.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {JOB_TYPE_LABELS[job.type] ?? job.type}
          </span>
          <CollectionChip status={job.collectionStatus} />
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {JOB_STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>
      </div>

      {/* Origen: registro importado desde el Excel histórico de reconciliación */}
      {job.importRef && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <AutoFilledBadge reason={`Origen del registro: ${job.importRef}`} />
          Este trabajo se cargó desde la importación histórica, no fue creado a mano — algunos datos pueden venir tal cual del Excel original.
        </div>
      )}

      {/* Info grid */}
      <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-4">
        <InfoRow
          label="Código"
          value={job.code ?? ''}
          autoFilled={job.code ? 'Generado automáticamente (YYMMDD-CLIENTE-TIPO-N°)' : undefined}
        />
        <InfoRow label="N° trabajo" value={job.jobNumber?.toString() ?? ''} />
        <InfoRow label="Centro de costo" value={job.costCenter ?? ''} />
        <InfoRow label="Ref. cotización" value={job.quoteRef ?? ''} />
        <InfoRow label="N° OC" value={job.purchaseOrder ?? ''} />
        <InfoRow label="N° factura" value={job.invoiceNumber ?? ''} />
        <InfoRow label="Fecha ejecución" value={toDateInput(job.executionDate)} />
        <InfoRow label="Fecha OC" value={toDateInput(job.purchaseOrderDate)} />
        <InfoRow label="Fecha factura" value={toDateInput(job.invoiceDate)} />
        <InfoRow label="Fecha pago" value={toDateInput(job.paymentDate)} />
        <InfoRow label="Días crédito" value={job.creditDays?.toString() ?? ''} />
        <InfoRow label="Forma de pago" value={job.paymentMethodRaw ?? ''} />
        <InfoRow
          label="Total (neto + IVA)"
          value={clp(total)}
          autoFilled={job.taxAmount == null ? 'IVA calculado automáticamente como 19% del neto (no se ingresó un monto de IVA manual)' : undefined}
        />
      </div>

      {/* Edit form */}
      <div className="mt-8">
        <h2 className="mb-4 text-base font-semibold text-ink">Editar trabajo</h2>
        <JobForm
          action={updateJob.bind(null, job.id)}
          branches={branches}
          technicians={technicianRows}
          clientId={job.clientId}
          initial={job}
        />
      </div>

      {/* Cost list */}
      <CostList costs={job.costs} jobId={job.id} netAmount={job.netAmount} />

      {/* Client documents */}
      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Documentos del cliente</h2>
          <div className="flex items-center gap-3">
            <Link href="/cotizador" className="text-xs font-semibold text-brand hover:underline">
              + Propuesta
            </Link>
            <Link href="/informe" className="text-xs font-semibold text-brand hover:underline">
              + Informe
            </Link>
            <Link href="/documentos" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Ver carpeta →
            </Link>
          </div>
        </div>
        {clientDocs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400">
            {job.originTicketId || job.originProposalId
              ? 'Sin documentos vinculados a este trabajo todavía.'
              : 'Este trabajo no tiene ticket ni propuesta de origen — no hay documentos que vincular automáticamente.'}
            {' '}
            <Link href="/cotizador" className="font-semibold text-brand hover:underline">
              Crear propuesta →
            </Link>
            {' '}o{' '}
            <Link href="/informe" className="font-semibold text-brand hover:underline">
              Crear informe →
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {clientDocs.map((doc, i) => {
              const cfg = DOC_TYPE[doc.type] ?? DOC_TYPE.otro
              const editorHref = `/${doc.type === 'propuesta' ? 'cotizador' : 'informe'}?docId=${doc.id}`
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i < clientDocs.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <span className="flex-1 truncate text-sm text-gray-800">{doc.title}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {doc.createdAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <Link href={editorHref} className="shrink-0 text-xs font-semibold text-brand hover:underline">
                    Editar →
                  </Link>
                </div>
              )
            })}
          </div>
        )}
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
