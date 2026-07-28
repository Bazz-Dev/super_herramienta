import { prisma } from '@/lib/prisma'
import { tenantScope, requireActor } from '@/lib/tenant'
import Link from 'next/link'
import { NewTicketForm } from '@/components/tickets/new-ticket-form'

export const metadata = { title: 'Nuevo ticket — INGEGAR' }

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>
}) {
  // requireActor aplica "ver como" (viewas) — no usar session.user directo aquí
  const actor = await requireActor()
  const { jobId } = await searchParams

  const [clients, users, sourceJob] = await Promise.all([
    prisma.client.findMany({
      where: tenantScope(actor),
      select: { id: true, name: true, portalSlug: true, branches: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { ...tenantScope(actor), role: { in: ['super', 'supervisor', 'tecnico'] }, active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    jobId
      ? prisma.job.findFirst({ where: { id: jobId, ...tenantScope(actor), originTicketId: null }, select: { id: true, clientId: true, branchId: true, description: true } })
      : Promise.resolve(null),
  ])

  const defaults = sourceJob
    ? { clientId: sourceJob.clientId, branchId: sourceJob.branchId ?? undefined, title: sourceJob.description.slice(0, 80), description: sourceJob.description }
    : undefined

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={sourceJob ? '/conciliacion' : '/tickets'} className="text-sm text-gray-400 hover:text-brand transition">
          ← {sourceJob ? 'Conciliación' : 'Tickets'}
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-ink">Nuevo ticket</h1>
      </div>

      {sourceJob && (
        <div className="rounded-lg border border-brand/40 bg-brand/10 px-4 py-2.5 text-sm text-ink">
          Precargado desde el trabajo de Flujo de Caja — se vinculará automáticamente al guardar.
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <NewTicketForm
          clients={clients}
          users={users}
          createdById={actor.id}
          defaults={defaults}
          linkJobId={sourceJob?.id}
        />
      </div>
    </div>
  )
}
