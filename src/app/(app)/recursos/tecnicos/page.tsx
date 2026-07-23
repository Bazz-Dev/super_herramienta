import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { requireActor } from '@/lib/tenant'
import { listTechnicians } from '@/lib/resources/technicians'
import {
  CONTRACT_TYPE_BADGE,
  CONTRACT_TYPE_CARD,
  CONTRACT_TYPE_DOT,
  CONTRACT_TYPE_LABELS,
  CONTRACT_TYPE_ACTIVE,
  CONTRACT_TYPE_TERMINATED,
  type ContractTypeId,
} from '@/lib/resources/labels'

function calcAge(birthDate: Date | null | undefined): number | null {
  if (!birthDate) return null
  const d = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

function daysUntil(d: Date | null | undefined): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isBirthdaySoon(birthDate: Date | null | undefined): boolean {
  if (!birthDate) return false
  const d = new Date(birthDate)
  const now = new Date()
  const nextBday = new Date(now.getFullYear(), d.getMonth(), d.getDate())
  if (nextBday < now) nextBday.setFullYear(now.getFullYear() + 1)
  return (nextBday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7
}

export default async function TecnicosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const actor = await requireActor()
  const { q } = await searchParams
  const technicians = await listTechnicians(actor, q)

  const active     = technicians.filter((t) => t.active)
  const terminated = technicians.filter((t) => !t.active && CONTRACT_TYPE_TERMINATED.includes((t.contractType ?? '') as ContractTypeId))
  const inactive   = technicians.filter((t) => !t.active && !CONTRACT_TYPE_TERMINATED.includes((t.contractType ?? '') as ContractTypeId))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Técnicos</h1>
        </div>
        <Link
          href="/recursos/tecnicos/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          <PlusIcon /> Nuevo técnico
        </Link>
      </div>

      <form className="mt-5" action="/recursos/tecnicos" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre, especialidad o RUT…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </form>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Activos:</span>
        {CONTRACT_TYPE_ACTIVE.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${CONTRACT_TYPE_DOT[t]}`} />
            {CONTRACT_TYPE_LABELS[t]}
          </span>
        ))}
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Desvinculados:</span>
        {CONTRACT_TYPE_TERMINATED.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${CONTRACT_TYPE_DOT[t as ContractTypeId]}`} />
            {CONTRACT_TYPE_LABELS[t as ContractTypeId]}
          </span>
        ))}
      </div>

      {technicians.length === 0 ? (
        <p className="mt-8 text-center text-sm text-gray-400">
          {q ? 'Sin resultados.' : 'Aún no hay técnicos. Crea el primero.'}
        </p>
      ) : (
        <>
          {/* Active */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((t) => {
              const contractType = (t.contractType ?? 'indefinido') as ContractTypeId
              const age = calcAge(t.birthDate)
              const contractDays = daysUntil(t.contractEndDate)
              const contractExpired = contractDays != null && contractDays < 0
              const contractWarn = contractDays != null && contractDays >= 0 && contractDays <= 30
              const bdSoon = isBirthdaySoon(t.birthDate)
              const waPhone = t.phone ? t.phone.replace(/\D/g, '') : null

              return (
                <div
                  key={t.id}
                  className={`relative overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${CONTRACT_TYPE_CARD[contractType]}`}
                >
                  {/* Top accent bar */}
                  <div className={`h-1.5 w-full ${CONTRACT_TYPE_DOT[contractType]}`} />

                  <div className="p-4">
                    {/* Header row: avatar + name + contact buttons */}
                    <div className="flex items-start gap-3">
                      {/* Avatar 48×48 */}
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${CONTRACT_TYPE_BADGE[contractType]}`}>
                        {t.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>

                      {/* Name + specialty */}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/recursos/tecnicos/${t.id}`}
                          className="block truncate font-semibold text-ink hover:text-brand-700 hover:underline"
                        >
                          {t.name}
                          {bdSoon && <span className="ml-1" title="Cumpleaños próximo">🎂</span>}
                        </Link>
                        <p className="truncate text-xs text-gray-500">{t.specialty ?? 'Sin especialidad'}</p>
                      </div>

                      {/* Contact buttons — 44px touch target each */}
                      {t.phone && (
                        <div className="flex shrink-0 gap-1">
                          <a
                            href={`tel:${t.phone}`}
                            title={`Llamar a ${t.name}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 active:bg-gray-300"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                          </a>
                          {waPhone && (
                            <a
                              href={`https://wa.me/${waPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`WhatsApp a ${t.name}`}
                              className="flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-600 transition hover:bg-green-100 active:bg-green-200"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Badges row */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTRACT_TYPE_BADGE[contractType]}`}>
                        {CONTRACT_TYPE_LABELS[contractType]}
                      </span>
                      {age != null && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                          {age} años
                        </span>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="my-3 border-t border-gray-100" />

                    {/* Info rows */}
                    <div className="space-y-1.5 text-sm">
                      {/* Vehicle */}
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">🚗</span>
                        {t.vehicle ? (
                          <Link
                            href={`/recursos/vehiculos/${t.vehicle.id}`}
                            className="font-medium text-gray-700 hover:text-brand hover:underline"
                          >
                            {t.vehicle.plate}
                          </Link>
                        ) : (
                          <span className="italic text-gray-400">Sin camioneta</span>
                        )}
                        {t.vehicle && (
                          <span className="ml-auto rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            🔧 {t.vehicle._count.assets}
                          </span>
                        )}
                      </div>

                      {/* Contract end date */}
                      {t.contractEndDate && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="text-base leading-none">📋</span>
                          <span>Contrato hasta {formatDate(t.contractEndDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* Contract expiry alert strip */}
                    {(contractExpired || contractWarn) && (
                      <p className={`mt-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${contractExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {contractExpired
                          ? `⚠ Contrato vencido el ${formatDate(t.contractEndDate)}`
                          : `⚠ Contrato vence en ${contractDays} días (${formatDate(t.contractEndDate)})`}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between border-t border-gray-200/60 pt-3">
                      <span className="text-xs text-gray-400">
                        {t._count.crews} cuadrilla{t._count.crews !== 1 ? 's' : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/technicians/${t.id}/documents/zip`}
                          title={`Descargar documentos de ${t.name} (ZIP)`}
                          className="rounded-md border border-gray-300 px-2.5 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          ZIP
                        </a>
                        <Link
                          href={`/recursos/tecnicos/${t.id}`}
                          className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                        >
                          Ver ficha →
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Terminated — no_renovado / despedido */}
          {terminated.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Desvinculados ({terminated.length})
              </h2>
              <div className="divide-y divide-gray-100 rounded-xl border border-red-100 bg-white">
                {terminated.map((t) => {
                  const ct = (t.contractType ?? 'despedido') as ContractTypeId
                  return (
                    <div key={t.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${CONTRACT_TYPE_DOT[ct]}`} />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-500">{t.name}</span>
                          {t.specialty && <span className="ml-2 text-xs text-gray-400">{t.specialty}</span>}
                        </div>
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${CONTRACT_TYPE_BADGE[ct]}`}>
                          {CONTRACT_TYPE_LABELS[ct]}
                        </span>
                      </div>
                      <Link
                        href={`/recursos/tecnicos/${t.id}`}
                        className="text-xs text-gray-400 hover:text-gray-700 hover:underline shrink-0 ml-4"
                      >
                        Ver ficha →
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Inactive — other reasons */}
          {inactive.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Inactivos ({inactive.length})
              </h2>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                {inactive.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="text-sm text-gray-500 line-through">{t.name}</span>
                      {t.specialty && <span className="ml-2 text-xs text-gray-400">{t.specialty}</span>}
                    </div>
                    <Link
                      href={`/recursos/tecnicos/${t.id}`}
                      className="text-xs text-gray-400 hover:text-gray-700 hover:underline"
                    >
                      Ver ficha →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
