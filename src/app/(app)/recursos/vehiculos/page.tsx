import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/resources/actor'
import { listVehicles } from '@/lib/resources/vehicles'
import { VEHICLE_STATUS_BADGE, VEHICLE_STATUS_LABELS, type VehicleStatusId } from '@/lib/resources/labels'
import { deleteVehicle } from './actions'

const GPS_URL = process.env.NEXT_PUBLIC_GPS_URL ?? ''

type Expiry = {
  label: string
  value: Date | null | undefined
}

function expiryBadge(d: Date | null | undefined): { text: string; cls: string } | null {
  if (!d) return null
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const formatted = new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })
  if (days < 0) return { text: `Vencido ${formatted}`, cls: 'bg-red-100 text-red-700' }
  if (days <= 30) return { text: `Vence ${formatted}`, cls: 'bg-amber-100 text-amber-700' }
  return null
}

function collectAlerts(expiries: Expiry[]): { label: string; badge: ReturnType<typeof expiryBadge> }[] {
  return expiries.flatMap(({ label, value }) => {
    const badge = expiryBadge(value)
    return badge ? [{ label, badge }] : []
  })
}

export default async function VehiculosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requireActor()
  const { q } = await searchParams
  const vehicles = await listVehicles(actor, q)
  const isSuper = actor.role === 'super'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">← Recursos</Link>
          <h1 className="text-2xl font-bold">Vehículos / camionetas</h1>
        </div>
        <div className="flex items-center gap-2">
          {GPS_URL && (
            <a
              href={GPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              title="Abrir plataforma GPS MiCODUS"
            >
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              GPS
            </a>
          )}
          <Link
            href="/recursos/vehiculos/new"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
          >
            <PlusIcon /> Nueva camioneta
          </Link>
        </div>
      </div>

      <form className="mt-5" action="/recursos/vehiculos" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por patente, marca o modelo…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {vehicles.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">{q ? 'Sin resultados.' : 'Aún no hay camionetas. Crea la primera.'}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Patente</th>
                <th className="px-4 py-2.5 font-medium">Vehículo</th>
                <th className="px-4 py-2.5 font-medium">Técnico</th>
                <th className="px-4 py-2.5 font-medium">Alertas</th>
                <th className="px-4 py-2.5 font-medium">Herramientas</th>
                {isSuper && <th className="px-4 py-2.5 font-medium">Tenant</th>}
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const expiries: Expiry[] = [
                  { label: 'Rev. técnica', value: v.revTecnicaExpiry },
                  { label: 'SOAP', value: v.soapExpiry },
                  { label: 'Permiso circ.', value: v.permisoCirculacionExpiry },
                  { label: 'Mantención', value: v.nextServiceDate },
                ]
                const alerts = collectAlerts(expiries)

                return (
                  <tr key={v.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 font-medium text-ink">{v.plate}</td>
                    <td className="px-4 py-2.5 text-gray-600">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {v.technician ? (
                        <Link href={`/recursos/tecnicos/${v.technician.id}`} className="hover:underline">
                          {v.technician.name}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {alerts.length === 0 ? (
                        <span className="text-xs text-gray-300">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {alerts.map(({ label, badge }) => (
                            <span key={label} className={`rounded px-1.5 py-0.5 text-xs ${badge!.cls}`}>
                              {label}: {badge!.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{v._count.assets}</td>
                    {isSuper && <td className="px-4 py-2.5 uppercase text-gray-500">{v.tenant.slug}</td>}
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${VEHICLE_STATUS_BADGE[v.status as VehicleStatusId]}`}>
                        {VEHICLE_STATUS_LABELS[v.status as VehicleStatusId]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/recursos/vehiculos/${v.id}`}
                          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          Editar
                        </Link>
                        <DeleteButton action={deleteVehicle.bind(null, v.id)} confirmText={`¿Eliminar ${v.plate}?`} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* GPS note */}
      {!GPS_URL && (
        <p className="mt-3 text-xs text-gray-400">
          Para activar el botón GPS, define <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_GPS_URL</code> en tu <code>.env</code>.
        </p>
      )}
    </div>
  )
}
