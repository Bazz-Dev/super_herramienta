import Link from 'next/link'
import { auth } from '@/auth'
import {
  listClientsForCashflow,
  listJobs,
  listAllBranches,
} from '@/lib/cashflow/queries'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { clp } from '@/lib/cashflow/format'
import { dateRange } from '@/lib/cashflow/period'
import { KpiCard } from '@/components/cashflow/kpi-card'
import { ClientFilter } from '@/components/cashflow/client-filter'
import { DateRangeFilter } from '@/components/cashflow/date-range-filter'
import { JobAccordion } from '@/components/cashflow/job-accordion'
import {
  MAIN_STATUS_CHIPS, mainStatusCounts, matchesMainStatus, type MainStatus,
  isOverdueV2, isDueSoon, isNoPOJob, isUnvaluedJob, isNoInvoiceJob,
} from '@/lib/cashflow/job-presets'
import { Suspense } from 'react'

// Rediseño para calzar con la referencia real (flujo de caja produccion/
// INGEGAR_Control_IngegarONE_UI_Acordeon_2026 (1).html), que el dueño pidió
// igualar explícitamente. Antes esta página tenía ~21 indicadores numéricos
// compitiendo (3 filas de KPI + 5 chips + 3 tarjetas de recordatorio
// duplicadas + 4 KPIs de gastos) antes de la lista de trabajos. Ahora:
// "Control de hoy" (4 indicadores de excepción, no dependen del período —
// mismo criterio que la referencia) + los chips + la lista, con cada
// trabajo mostrando su presupuesto/OC/factura/código en línea en vez de
// esconderlos detrás de un clic. Márgen/aging/mix/tendencia mensual/
// desglose por cliente viven en /flujo/reportes (análisis, no operación
// diaria). Gastos operacionales tiene su propia página (/gastos).
export default async function FlujoPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; desde?: string; hasta?: string; estado?: string }>
}) {
  const session = await auth()
  const actor = session!.user
  const { cliente, desde, hasta, estado } = await searchParams
  const { from, to } = dateRange(desde, hasta)
  const now = new Date()

  const [clients, jobs, controlJobs, branches, technicians] = await Promise.all([
    listClientsForCashflow(actor),
    listJobs(actor, { clientId: cliente, from, to }),
    // "Control de hoy" — respeta el filtro de cliente (es una entidad, no
    // una ventana de tiempo) pero NUNCA el período: son los mismos
    // indicadores sin importar qué rango esté mirando el usuario, igual que
    // en la referencia ("Estos indicadores no dependen del período
    // seleccionado").
    listJobs(actor, { clientId: cliente }),
    // Edición rápida del acordeón necesita sucursal/técnico por trabajo —
    // se cargan una vez acá (no por tarjeta) y se filtran por clientId en
    // el cliente.
    listAllBranches(actor),
    prisma.technician.findMany({
      where: { ...tenantScope(actor), active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Estado documental de OT/Informe (bloque C de edición rápida) — se
  // resuelve en 2 consultas batch para toda la lista visible en vez de una
  // por tarjeta. OT vive en el ticket de origen (Ticket.otFileUrl); Informe
  // es un ClientDocument type=informe vinculado al mismo ticket — mismo
  // criterio que ya usa "Documentos del cliente" en /flujo/trabajos/[id].
  const originTicketIds = [...new Set(jobs.map((j) => j.originTicketId).filter((v): v is string => !!v))]
  const [otTickets, informeDocs] = originTicketIds.length
    ? await Promise.all([
        prisma.ticket.findMany({ where: { id: { in: originTicketIds } }, select: { id: true, otFileUrl: true } }),
        prisma.clientDocument.findMany({ where: { ticketId: { in: originTicketIds }, type: 'informe' }, select: { id: true, ticketId: true } }),
      ])
    : [[], []]
  const otByTicket = new Map(otTickets.map((t) => [t.id, t.otFileUrl]))
  const informeByTicket = new Map(informeDocs.filter((d) => d.ticketId).map((d) => [d.ticketId as string, d.id]))
  const withDocStatus = <T extends { originTicketId: string | null }>(rows: T[]) =>
    rows.map((j) => ({
      ...j,
      otFileUrl: j.originTicketId ? otByTicket.get(j.originTicketId) ?? null : null,
      informeDocId: j.originTicketId ? informeByTicket.get(j.originTicketId) ?? null : null,
    }))

  const DAY = 24 * 60 * 60 * 1000
  const controlTyped = controlJobs as unknown as Parameters<typeof mainStatusCounts>[0]
  const overdueJobs = controlTyped.filter((j) => isOverdueV2(j, now))
  const dueSoonJobs = controlTyped.filter((j) => isDueSoon(j, now))
  const noPOJobs = controlTyped.filter(isNoPOJob)
  const upcomingJobs = controlTyped.filter((j) => j.executionDate && j.executionDate.getTime() > now.getTime() && j.executionDate.getTime() <= now.getTime() + 7 * DAY)
  const unvaluedCount = controlTyped.filter(isUnvaluedJob).length
  const noInvoiceCount = controlTyped.filter(isNoInvoiceJob).length
  const sum = (xs: typeof controlTyped) => xs.reduce((s, j) => s + (j.netAmount ?? 0), 0)

  // Status-strip del prototipo (renderDashboard final) — 5 chips
  // (Todos/Pagadas/Pendientes de pago/Ejecutadas sin OC/No aprobadas),
  // filtran la lista de trabajos de abajo. Ver src/lib/cashflow/job-presets.ts.
  const jobsTyped = withDocStatus(jobs) as unknown as Parameters<typeof mainStatusCounts>[0]
  const statusCounts = mainStatusCounts(jobsTyped)
  const activeStatus: MainStatus | 'overdue' | 'due_soon' = (['all', 'paid', 'pending', 'no_po', 'rejected', 'overdue', 'due_soon'] as const).includes(estado as never)
    ? (estado as MainStatus | 'overdue' | 'due_soon')
    : 'all'
  const visibleJobs = activeStatus === 'all' ? jobsTyped : jobsTyped.filter((j) => matchesMainStatus(j, activeStatus, now))
  const statusHref = (key: string) => {
    const p = new URLSearchParams()
    if (cliente) p.set('cliente', cliente)
    if (desde) p.set('desde', desde)
    if (hasta) p.set('hasta', hasta)
    if (key !== 'all') p.set('estado', key)
    return `/flujo?${p.toString()}`
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Flujo de Caja</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cobranza y rentabilidad por trabajo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}><DateRangeFilter basePath="/flujo" desde={desde} hasta={hasta} /></Suspense>
          <ClientFilter clients={clients} />
          <Link
            href="/flujo/trabajos/new"
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-ink hover:bg-brand-600"
          >
            + Nuevo trabajo
          </Link>
        </div>
      </div>

      {/* Control de hoy — solo excepciones que requieren una decisión, no
          totales de facturación (esos viven en /flujo/reportes). No dependen
          del período seleccionado arriba, igual que la referencia. */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">Control de hoy</h2>
            <p className="text-xs text-gray-500">Solo lo que requiere una decisión. Estos indicadores no dependen del período seleccionado.</p>
          </div>
          <span className="text-xs text-gray-400">
            Actualizado {now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Facturas vencidas" value={String(overdueJobs.length)} hint={`${clp(sum(overdueJobs))} por cobrar`}
            tone={overdueJobs.length > 0 ? 'danger' : 'default'} href={statusHref('overdue')}
          />
          <KpiCard
            label="Vencen en 7 días" value={String(dueSoonJobs.length)} hint={`${clp(sum(dueSoonJobs))} próximos`}
            tone={dueSoonJobs.length > 0 ? 'warn' : 'default'} href={statusHref('due_soon')}
          />
          <KpiCard
            label="Ejecutados sin OC" value={String(noPOJobs.length)} hint={`${clp(sum(noPOJobs))} en gestión`}
            tone={noPOJobs.length > 0 ? 'warn' : 'default'} href={statusHref('no_po')}
          />
          <KpiCard
            label="Programados próximos" value={String(upcomingJobs.length)} hint="Dentro de los próximos 7 días"
            tone="info"
          />
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Otros controles: <span className="font-semibold text-gray-600">{unvaluedCount} sin valor</span>
          {' · '}
          <span className="font-semibold text-gray-600">{noInvoiceCount} ejecutados con OC y sin factura</span>
        </p>
      </section>

      {/* Trabajos, agrupados por cliente → período */}
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">Trabajos</h2>
          <Link href="/flujo/reportes" className="text-xs font-semibold text-brand hover:underline">
            Reportes →
          </Link>
        </div>

        {/* Status-strip — tarjetas verticales (label chico arriba, número
            grande abajo), igual al status-chip real del prototipo, no pills
            horizontales pequeñas. */}
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {MAIN_STATUS_CHIPS.map((c) => (
            <Link
              key={c.key}
              href={statusHref(c.key)}
              className={`flex min-h-[66px] flex-col justify-center rounded-xl border px-3 py-2.5 text-left transition-all duration-150 hover:-translate-y-px hover:shadow-sm ${
                activeStatus === c.key ? 'border-ink shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{c.label}</span>
              <strong className="mt-1 text-xl font-extrabold tabular-nums text-ink">{statusCounts[c.key]}</strong>
            </Link>
          ))}
        </div>

        <JobAccordion
          jobs={visibleJobs as unknown as Parameters<typeof JobAccordion>[0]['jobs']}
          branches={branches}
          technicians={technicians}
        />
      </div>

      {/* Quick links — análisis (margen/aging/mix/tendencia/por cliente),
          gastos operacionales y sucursales viven en sus propias páginas,
          no repetidos acá. */}
      <div className="mt-6 flex flex-wrap gap-4 border-t border-gray-100 pt-4 text-sm text-gray-400">
        <Link href="/flujo/reportes" className="hover:text-ink hover:underline">
          Ver análisis y reportes →
        </Link>
        <Link href="/flujo/sucursales" className="hover:text-ink hover:underline">
          Administrar sucursales →
        </Link>
        <Link href="/gastos" className="hover:text-ink hover:underline">
          Gastos operacionales →
        </Link>
      </div>
    </div>
  )
}
