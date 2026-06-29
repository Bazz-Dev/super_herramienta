import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/resources/actor'
import { listVehicles } from '@/lib/resources/vehicles'
import { VEHICLE_STATUS_BADGE, VEHICLE_STATUS_LABELS, type VehicleStatusId } from '@/lib/resources/labels'
import { deleteVehicle } from './actions'

const GPS_URL = process.env.NEXT_PUBLIC_GPS_URL ?? ''

function expiryInfo(d: Date | null | undefined): { text: string; cls: string; urgent: boolean } | null {
  if (!d) return null
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  const fmt = new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
  if (days < 0) return { text: `Vencido ${fmt}`, cls: 'bg-red-100 text-red-700', urgent: true }
  if (days <= 30) return { text: `Vence ${fmt} (${days}d)`, cls: 'bg-amber-100 text-amber-700', urgent: true }
  return { text: fmt, cls: 'bg-green-50 text-green-700', urgent: false }
}

export default async function VehiculosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor()
  const { q } = await searchParams
  const vehicles = await listVehicles(actor, q)
  const isSuper = actor.role === 'super'

  const alertCount = vehicles.reduce((acc, v) => {
    const checks = [v.revTecnicaExpiry, v.soapExpiry, v.permisoCirculacionExpiry, v.nextServiceDate]
    const hasAlert = checks.some(d => d && Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) <= 30)
    return acc + (hasAlert ? 1 : 0)
  }, 0)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">← Recursos</Link>
          <h1 className="text-2xl font-bold">Vehículos</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {vehicles.length} camioneta{vehicles.length !== 1 ? 's' : ''}
            {alertCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {alertCount} con alertas
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {GPS_URL && (
            <a href={GPS_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              GPS
            </a>
          )}
          <Link href="/recursos/vehiculos/new"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition hover:opacity-90">
            <PlusIcon /> Nueva camioneta
          </Link>
        </div>
      </div>

      <form className="mt-5" action="/recursos/vehiculos" method="get">
        <input name="q" defaultValue={q ?? ''} placeholder="Buscar por patente, marca o modelo…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30" />
      </form>

      {vehicles.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-sm text-gray-400">{q ? 'Sin resultados.' : 'Aún no hay camionetas. Crea la primera.'}</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const docs = [
              { label: 'Rev. técnica', d: v.revTecnicaExpiry },
              { label: 'SOAP', d: v.soapExpiry },
              { label: 'Permiso circ.', d: v.permisoCirculacionExpiry },
              { label: 'Mantención', d: v.nextServiceDate },
            ]
            const urgentDocs = docs.filter(({ d }) => {
              if (!d) return false
              return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) <= 30
            })
            const expiredDocs = docs.filter(({ d }) => {
              if (!d) return false
              return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) < 0
            })
            const allDocsOk = docs.every(({ d }) => {
              if (!d) return true
              return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) > 30
            })
            // Top bar color: red if any expired, amber if any expiring ≤30d, green if all fine
            const barColor = expiredDocs.length > 0 ? 'bg-red-500' : urgentDocs.length > 0 ? 'bg-amber-400' : 'bg-green-500'
            const borderColor = expiredDocs.length > 0 ? 'border-red-200' : urgentDocs.length > 0 ? 'border-amber-200' : 'border-gray-200'

            return (
              <div key={v.id} className={`relative overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${borderColor}`}>
                {/* Top color bar */}
                <div className={`h-1.5 w-full ${barColor}`} />

                {/* Card header */}
                <div className={`flex items-center justify-between px-4 pt-3 pb-2`}>
                  <div className="min-w-0">
                    <p className="text-xl font-bold tracking-wider text-ink">{v.plate}</p>
                    <p className="truncate text-xs text-gray-500">{[v.brand, v.model, v.year].filter(Boolean).join(' · ') || 'Sin datos'}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VEHICLE_STATUS_BADGE[v.status as VehicleStatusId]}`}>
                      {VEHICLE_STATUS_LABELS[v.status as VehicleStatusId]}
                    </span>
                    {/* Asset count pill */}
                    <span className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3 w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                      </svg>
                      {v._count.assets}
                    </span>
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-4 border-t border-gray-100" />

                {/* Card body */}
                <div className="space-y-2.5 px-4 py-3">
                  {/* Técnico */}
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    {v.technician ? (
                      <Link href={`/recursos/tecnicos/${v.technician.id}`} className="font-medium text-gray-700 hover:text-brand hover:underline">
                        {v.technician.name}
                      </Link>
                    ) : (
                      <span className="italic text-gray-400">Sin técnico asignado</span>
                    )}
                  </div>

                  {isSuper && (
                    <div className="text-xs text-gray-400 uppercase tracking-wide">{v.tenant.slug}</div>
                  )}

                  {/* Document status */}
                  {allDocsOk ? (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                      Documentos al día
                    </div>
                  ) : (
                    <div className={`rounded-lg border p-2.5 space-y-1 ${expiredDocs.length > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                      {urgentDocs.map(({ label, d }) => {
                        const info = expiryInfo(d)!
                        return (
                          <div key={label} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">{label}</span>
                            <span className={`rounded px-1.5 py-0.5 font-medium ${info.cls}`}>{info.text}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Card footer */}
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <Link href={`/recursos/vehiculos/${v.id}`}
                    className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50">
                    Ver / Editar
                  </Link>
                  <DeleteButton action={deleteVehicle.bind(null, v.id)} confirmText={`¿Eliminar ${v.plate}?`} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!GPS_URL && (
        <p className="mt-4 text-xs text-gray-400">
          Para activar el botón GPS, define <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_GPS_URL</code> en tu <code>.env</code>.
        </p>
      )}
    </div>
  )
}
