import Link from 'next/link'
import { Suspense } from 'react'
import { requireActor } from '@/lib/tenant'
import { listJobs, listClientsForCashflow, listBranchesForClient } from '@/lib/cashflow/queries'
import { clp } from '@/lib/cashflow/format'
import { JobFilters } from '@/components/cashflow/job-filters'
import { JobRow } from '@/components/cashflow/job-row'
import { REPORT_PRESETS, reportPresetCounts, matchesReportPreset, type ReportPreset } from '@/lib/cashflow/job-presets'

export default async function TrabajosPage({
  searchParams,
}: {
  searchParams: Promise<{
    cliente?: string
    estado?: string
    tipo?: string
    sucursal?: string
    desde?: string
    hasta?: string
    flujo?: string
    financiero?: string
    preset?: string
  }>
}) {
  const actor = await requireActor()
  const { cliente, estado, tipo, sucursal, desde, hasta, flujo, financiero, preset } = await searchParams

  const [clients, branches, allJobs] = await Promise.all([
    listClientsForCashflow(actor),
    cliente ? listBranchesForClient(actor, cliente) : Promise.resolve([]),
    listJobs(actor, {
      clientId: cliente,
      collectionStatus: estado,
      tipo,
      branchId: sucursal,
      processFlow: flujo,
      financialStage: financiero,
      from: desde ? new Date(desde) : undefined,
      to: hasta ? new Date(hasta) : undefined,
    }),
  ])

  // Presets tipo Reportes del prototipo (Vencidos/Sin OC/Sin facturar/Pendientes
  // de pago/Pagados/Sin valor) — ver src/lib/cashflow/job-presets.ts. Los conteos
  // reflejan los demás filtros activos, igual que v11PresetCounts en el original.
  const presetCounts = reportPresetCounts(allJobs)
  const activePreset = (preset as ReportPreset) in presetCounts ? (preset as ReportPreset) : 'all'
  const jobs = activePreset === 'all' ? allJobs : allJobs.filter((j) => matchesReportPreset(j, activePreset, new Date()))

  const totalNeto = jobs.reduce((s, j) => s + (j.netAmount ?? 0), 0)
  const showClientCol = !cliente && clients.length > 1

  // Build export URL with current filters
  const exportParams = new URLSearchParams()
  if (cliente) exportParams.set('cliente', cliente)
  if (estado) exportParams.set('estado', estado)
  if (tipo) exportParams.set('tipo', tipo)
  if (sucursal) exportParams.set('sucursal', sucursal)
  if (desde) exportParams.set('desde', desde)
  if (hasta) exportParams.set('hasta', hasta)
  if (flujo) exportParams.set('flujo', flujo)
  if (financiero) exportParams.set('financiero', financiero)
  if (activePreset !== 'all') exportParams.set('preset', activePreset)

  const presetHref = (key: ReportPreset) => {
    const p = new URLSearchParams(exportParams)
    p.delete('preset')
    if (key !== 'all') p.set('preset', key)
    return `/flujo/trabajos?${p.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/flujo" className="text-xs text-gray-400 hover:text-gray-600">
            ← Flujo
          </Link>
          <h1 className="text-2xl font-bold">Trabajos</h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/flujo/export?${exportParams.toString()}`}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            download
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </a>
          <Link
            href="/flujo/trabajos/new"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
          >
            + Nuevo trabajo
          </Link>
        </div>
      </div>

      <Suspense>
        <JobFilters clients={clients} branches={branches} />
      </Suspense>

      <div className="mt-4 flex flex-wrap gap-2">
        {REPORT_PRESETS.map((p) => (
          <Link
            key={p.key}
            href={presetHref(p.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activePreset === p.key
                ? 'border-brand bg-brand/15 text-ink'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activePreset === p.key ? 'bg-brand text-ink' : 'bg-gray-100 text-gray-500'}`}>
              {presetCounts[p.key]}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            Sin trabajos con este filtro.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Fecha ejec.</th>
                {showClientCol && <th className="px-4 py-2.5 font-medium">Cliente</th>}
                <th className="px-4 py-2.5 font-medium">Sucursal</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium text-right">Neto</th>
                <th className="px-4 py-2.5 font-medium">Estado pago</th>
                <th className="px-2 py-2.5 font-medium" title="Expandir costos" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <JobRow key={j.id} job={j} showClient={showClientCol} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td
                  colSpan={showClientCol ? 5 : 4}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-500"
                >
                  {jobs.length} {jobs.length === 1 ? 'trabajo' : 'trabajos'}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-ink">
                  {clp(totalNeto)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
