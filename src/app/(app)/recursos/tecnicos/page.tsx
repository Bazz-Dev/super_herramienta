import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { requireActor } from '@/lib/resources/actor'
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
  const terminated = technicians.filter((t) => !t.active && CONTRACT_TYPE_TERMINATED.includes((t.contractType ?? '') as never))
  const inactive   = technicians.filter((t) => !t.active && !CONTRACT_TYPE_TERMINATED.includes((t.contractType ?? '') as never))

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">
            ← Recursos
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

              return (
                <div
                  key={t.id}
                  className={`relative overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${CONTRACT_TYPE_CARD[contractType]}`}
                >
                  {/* Top accent bar */}
                  <div className={`h-1 w-full ${CONTRACT_TYPE_DOT[contractType]}`} />

                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      {/* Avatar */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${CONTRACT_TYPE_BADGE[contractType]}`}>
                        {t.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
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
                    </div>

                    {/* Tags */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_TYPE_BADGE[contractType]}`}>
                        {CONTRACT_TYPE_LABELS[contractType]}
                      </span>
                      {age != null && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {age} años
                        </span>
                      )}
                      {t.vehicle && (
                        <Link
                          href={`/recursos/vehiculos/${t.vehicle.id}`}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200"
                        >
                          🚗 {t.vehicle.plate}
                        </Link>
                      )}
                    </div>

                    {/* Contract expiry warning */}
                    {(contractExpired || contractWarn) && (
                      <p className={`mt-2 rounded-md px-2 py-1 text-xs font-medium ${contractExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {contractExpired
                          ? `⚠ Contrato vencido el ${formatDate(t.contractEndDate)}`
                          : `⚠ Contrato vence en ${contractDays} días (${formatDate(t.contractEndDate)})`}
                      </p>
                    )}

                    {/* Contact */}
                    {(t.phone || t.email) && (
                      <div className="mt-3 space-y-0.5 text-xs text-gray-500">
                        {t.phone && (
                          <a href={`tel:${t.phone}`} className="flex items-center gap-1 hover:text-ink">
                            <span>📞</span> {t.phone}
                          </a>
                        )}
                        {t.email && (
                          <p className="truncate">✉ {t.email}</p>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between border-t border-gray-200/60 pt-3">
                      <span className="text-xs text-gray-400">
                        {t._count.crews} cuadrilla{t._count.crews !== 1 ? 's' : ''}
                      </span>
                      <Link
                        href={`/recursos/tecnicos/${t.id}`}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        Ver ficha →
                      </Link>
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
