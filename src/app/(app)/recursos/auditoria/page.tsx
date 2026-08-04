import Link from 'next/link'
import { requireActor } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { auditLogWhere } from '@/lib/audit-query'
import { DateRangeFilter } from '@/components/cashflow/date-range-filter'
import { FilterBar, FilterSearch, FilterSelect, FilterClear } from '@/components/ui/filter-bar'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Auditoría — INGEGAR' }

const PAGE_SIZE = 40

const ENTITY_TYPES = ['User', 'Secret', 'Job', 'JobInstallment', 'ClientDocument', 'Ticket', 'TicketDocument'] as const

// Solo lectura — nunca se escribe acá (informe #32B: "un usuario normal no
// puede editar ni eliminar auditorías" — esta página ni siquiera renderiza
// un formulario, solo filtros de URL + tabla).
export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; actor?: string; entityType?: string; entityId?: string; action?: string; source?: string; page?: string }>
}) {
  const actor = await requireActor(['super', 'supervisor'])
  const { desde, hasta, actor: actorQuery, entityType, entityId, action, source, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)

  const where = auditLogWhere(actor, { desde, hasta, actor: actorQuery, entityType, entityId, action, source })

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      // createdAt solo no garantiza orden estable si dos eventos caen en el
      // mismo milisegundo (paginación podría repetir/saltarse filas) — id
      // como desempate, cuids son ordenables por tiempo de creación.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, action: true, entityType: true, entityId: true,
        before: true, after: true, reason: true, source: true, createdAt: true, actorRole: true,
        actor: { select: { name: true } },
      },
    }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const qs = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (desde) p.set('desde', desde)
    if (hasta) p.set('hasta', hasta)
    if (actorQuery) p.set('actor', actorQuery)
    if (entityType) p.set('entityType', entityType)
    if (entityId) p.set('entityId', entityId)
    if (action) p.set('action', action)
    if (source) p.set('source', source)
    Object.entries(overrides).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)))
    return `/recursos/auditoria?${p.toString()}`
  }

  const hasFilters = !!(desde || hasta || actorQuery || entityType || entityId || action || source)

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">← Dashboard</Link>
      <h1 className="text-2xl font-bold">Auditoría</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Registro de acciones sensibles: usuarios, secretos, OC/facturas/cuotas, propuestas, documentos y tickets.
        Solo lectura — nunca se puede editar ni eliminar un registro desde acá.
      </p>

      <div className="mt-4">
        <DateRangeFilter basePath="/recursos/auditoria" desde={desde} hasta={hasta} />
      </div>

      <form className="mt-3" action="/recursos/auditoria" method="get">
        {desde && <input type="hidden" name="desde" value={desde} />}
        {hasta && <input type="hidden" name="hasta" value={hasta} />}
        <FilterBar action={<Button type="submit" size="sm" variant="secondary">Filtrar</Button>}>
          <FilterSearch name="actor" placeholder="Actor (nombre)…" defaultValue={actorQuery} />
          <FilterSelect name="entityType" defaultValue={entityType}>
            <option value="">Todas las entidades</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
          <FilterSearch name="entityId" placeholder="ID de entidad…" defaultValue={entityId} />
          <FilterSearch name="action" placeholder="Acción (ej: user.create)…" defaultValue={action} />
          <FilterSearch name="source" placeholder="Módulo/origen (ej: flujo/actions.ts)…" defaultValue={source} />
          {hasFilters && <FilterClear href="/recursos/auditoria" />}
        </FilterBar>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {logs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-ink">No hay registros con este filtro</p>
            <p className="mt-1 text-xs text-gray-400">Prueba otro rango de fechas o entidad.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Acción</th>
                <th className="px-4 py-2.5 font-medium">Entidad</th>
                <th className="px-4 py-2.5 font-medium">Cambio</th>
                <th className="px-4 py-2.5 font-medium">Origen</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">
                    {l.createdAt.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-ink">{l.actor?.name ?? '—'}</div>
                    <div className="text-xs text-gray-400">{l.actorRole}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-brand">{l.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{l.entityType}<br />{l.entityId.slice(0, 10)}…</td>
                  <td className="max-w-sm px-4 py-2.5 text-xs text-gray-600">
                    <ChangeSummary before={l.before} after={l.after} />
                    {l.reason && <div className="mt-1 italic text-gray-400">{l.reason}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Página {page} de {totalPages} · {total} registros</span>
          <div className="flex gap-2">
            <Link href={qs({ page: String(Math.max(1, page - 1)) })} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Anterior</Link>
            <Link href={qs({ page: String(Math.min(totalPages, page + 1)) })} className="rounded-md border border-gray-300 px-2.5 py-1 hover:bg-gray-50">Siguiente</Link>
          </div>
        </div>
      )}
    </div>
  )
}

function ChangeSummary({ before, after }: { before: string | null; after: string | null }) {
  if (!before && !after) return <span className="text-gray-300">—</span>
  const b = before ? (JSON.parse(before) as Record<string, unknown>) : null
  const a = after ? (JSON.parse(after) as Record<string, unknown>) : null
  const keys = new Set([...(b ? Object.keys(b) : []), ...(a ? Object.keys(a) : [])])
  return (
    <div className="space-y-0.5">
      {[...keys].map((k) => (
        <div key={k}>
          <span className="text-gray-400">{k}:</span>{' '}
          {b && k in b && <span className="text-gray-400 line-through">{String(b[k])}</span>}{' '}
          {a && k in a && <span className="font-medium text-ink">{String(a[k])}</span>}
        </div>
      ))}
    </div>
  )
}
