import Link from 'next/link'
import { Suspense } from 'react'
import { requireActor, tenantScope } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { clp } from '@/lib/cashflow/format'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { buttonClass } from '@/components/ui/button'

export const metadata = { title: 'Conciliación — INGEGAR' }

type EstadoConciliacion = 'VINCULADO' | 'SIN_TICKET' | 'SIN_OT' | 'SIN_IT'

const ESTADO_LABEL: Record<EstadoConciliacion, string> = {
  VINCULADO: 'Vinculado',
  SIN_TICKET: 'Sin ticket',
  SIN_OT: 'Sin OT',
  SIN_IT: 'Sin IT',
}
const ESTADO_BADGE: Record<EstadoConciliacion, string> = {
  VINCULADO: 'bg-ok-100 text-ok-700',
  SIN_TICKET: 'bg-danger-100 text-danger-700',
  SIN_OT: 'bg-warn-100 text-warn-700',
  SIN_IT: 'bg-warn-100 text-warn-700',
}

const PAGE_SIZE = 30

// Vista de reconciliación Ticket <-> Flujo de Caja <-> OT/IT. No es un
// modelo nuevo — junta Job + su Ticket de origen (originTicketId, el mismo
// mecanismo que ya usa /tickets/[id]) y compara contra ClientDocument
// (type=informe) y Ticket.otFileUrl reales. Ver
// scripts/reconcile-2026-final-report.ts para la misma lógica en batch.
export default async function ConciliacionPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; estado?: string; page?: string }>
}) {
  const actor = await requireActor(['super', 'supervisor'])
  const { cliente, estado, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)

  const clients = await prisma.client.findMany({ where: tenantScope(actor), select: { id: true, name: true }, orderBy: { name: 'asc' } })

  const jobs = await prisma.job.findMany({
    where: { ...tenantScope(actor), ...(cliente ? { clientId: cliente } : {}) },
    select: {
      id: true, code: true, description: true, netAmount: true, docReport: true,
      client: { select: { id: true, name: true } }, branch: { select: { name: true } },
      originTicketId: true, originTicket: { select: { id: true, ticketCode: true, otFileUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const reportedTicketIds = new Set(
    (await prisma.clientDocument.findMany({ where: { type: 'informe', ticketId: { not: null } }, select: { ticketId: true } })).map((d) => d.ticketId),
  )

  const rows = jobs.map((j) => {
    const estados: EstadoConciliacion[] = []
    if (!j.originTicketId) estados.push('SIN_TICKET')
    else {
      estados.push('VINCULADO')
      if (!j.originTicket?.otFileUrl) estados.push('SIN_OT')
      if (j.docReport && !reportedTicketIds.has(j.originTicketId)) estados.push('SIN_IT')
    }
    return { job: j, estados }
  })

  const filtered = estado ? rows.filter((r) => r.estados.includes(estado as EstadoConciliacion)) : rows
  const counts = { VINCULADO: 0, SIN_TICKET: 0, SIN_OT: 0, SIN_IT: 0 } as Record<EstadoConciliacion, number>
  rows.forEach((r) => r.estados.forEach((e) => counts[e]++))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (cliente) p.set('cliente', cliente)
    if (estado) p.set('estado', estado)
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

      <div className="mt-5 flex flex-wrap gap-2">
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

      <div className="mt-3">
        <Suspense fallback={null}>
          <ClientFilter clients={clients} basePath="/conciliacion" />
        </Suspense>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {pageRows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-ink">No hay registros con este filtro</p>
            <p className="mt-1 text-xs text-gray-400">Pruebe otro cliente o estado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Trabajo</th>
                <th className="px-4 py-2.5 font-medium">Cliente / sucursal</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Ticket</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium text-right">Monto</th>
                <th className="px-4 py-2.5 font-medium">Acción siguiente</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(({ job, estados }) => (
                <tr key={job.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5"><Link href={`/flujo/trabajos/${job.id}`} className="font-mono text-xs text-brand hover:underline">{job.code ?? job.id.slice(0, 8)}</Link></td>
                  <td className="px-4 py-2.5"><div className="font-medium text-ink">{job.client.name}</div><div className="text-xs text-gray-400">{job.branch?.name ?? 'Sin sucursal'}</div></td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-gray-600">{job.description}</td>
                  <td className="px-4 py-2.5">
                    {job.originTicket ? <Link href={`/tickets/${job.originTicket.id}`} className="text-brand hover:underline">{job.originTicket.ticketCode}</Link> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {estados.map((e) => <span key={e} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_BADGE[e]}`}>{ESTADO_LABEL[e]}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{job.netAmount ? clp(job.netAmount) : '—'}</td>
                  <td className="px-4 py-2.5">
                    {!job.originTicketId && (
                      <Link href={`/tickets/new?jobId=${job.id}`} className={buttonClass('secondary', 'sm')}>
                        Crear ticket →
                      </Link>
                    )}
                    {job.originTicketId && (estados.includes('SIN_OT') || estados.includes('SIN_IT')) && (
                      <Link href={`/tickets/${job.originTicketId}`} className={buttonClass('secondary', 'sm')}>
                        {estados.includes('SIN_OT') ? 'Subir OT →' : 'Cargar informe →'}
                      </Link>
                    )}
                    {estados.length === 1 && estados[0] === 'VINCULADO' && (
                      <span className="text-xs text-gray-300">Completo</span>
                    )}
                  </td>
                </tr>
              ))}
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
    </div>
  )
}
