import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/tenant'
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

function StatPill({ value, total, label, tone = 'default' }: { value: number; total?: number; label: string; tone?: 'default' | 'ok' | 'warn' }) {
  const color = tone === 'warn' ? 'text-amber-600' : tone === 'ok' ? 'text-ok-700' : value > 0 ? 'text-ink' : 'text-gray-300'
  return (
    <div className="flex flex-col items-center rounded-md py-1.5 text-center">
      <span className={`text-sm font-bold ${color}`}>{total != null ? `${value}/${total}` : value}</span>
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  )
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
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">← Dashboard</Link>
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
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            const okDocsCount = docs.length - urgentDocs.length - expiredDocs.length

            return (
              <div key={v.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[11px] font-bold tracking-tight text-gray-700">
                    {v.plate}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/recursos/vehiculos/${v.id}`}
                      className="block truncate font-semibold text-ink hover:text-brand-700 hover:underline"
                    >
                      {v.plate}
                    </Link>
                    <p className="truncate text-xs text-gray-500">{[v.brand, v.model, v.year].filter(Boolean).join(' · ') || 'Sin datos'}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${VEHICLE_STATUS_BADGE[v.status as VehicleStatusId]}`}>
                        {VEHICLE_STATUS_LABELS[v.status as VehicleStatusId]}
                      </span>
                      {(expiredDocs.length > 0 || urgentDocs.length > 0) && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${expiredDocs.length > 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${expiredDocs.length > 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                          {expiredDocs.length > 0 ? `${expiredDocs.length} vencido(s)` : `${urgentDocs.length} por vencer`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-0.5 text-xs text-gray-500">
                  <p>
                    Técnico:{' '}
                    {v.technician ? (
                      <Link href={`/recursos/tecnicos/${v.technician.id}`} className="font-medium text-gray-700 hover:text-brand hover:underline">
                        {v.technician.name}
                      </Link>
                    ) : (
                      <span className="italic text-gray-400">sin asignar</span>
                    )}
                  </p>
                  {isSuper && <p className="uppercase text-gray-400">{v.tenant.slug}</p>}
                </div>

                {!allDocsOk && (
                  <div className={`rounded-lg border p-2 space-y-1 ${expiredDocs.length > 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                    {[...expiredDocs, ...urgentDocs].map(({ label, d }) => {
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

                <div className="grid grid-cols-2 gap-1.5 border-t border-gray-100 pt-3">
                  <StatPill value={v._count.assets} label="Herram." />
                  <StatPill value={okDocsCount} total={docs.length} label="Docs. al día" tone={allDocsOk ? 'ok' : 'warn'} />
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                  <Link href={`/recursos/vehiculos/${v.id}`}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50">
                    Editar
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
