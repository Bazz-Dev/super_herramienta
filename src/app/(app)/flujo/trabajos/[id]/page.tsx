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
import { updateJob, deleteJob } from '../../actions'

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
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

  const [branches, technicianRows] = await Promise.all([
    listBranches(actor, job.clientId),
    prisma.technician.findMany({
      where: { ...tenantScope(actor), active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const total = jobTotal(job)

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back link */}
      <Link href="/flujo/trabajos" className="text-xs text-gray-400 hover:text-gray-600">
        ← Trabajos
      </Link>

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

      {/* Info grid */}
      <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-4">
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
        <InfoRow label="Total (neto + IVA)" value={clp(total)} />
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
