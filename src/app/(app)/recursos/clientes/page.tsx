import Link from 'next/link'
import { PlusIcon } from '@/components/quotes/icons'
import { DeleteButton } from '@/components/resources/delete-button'
import { requireActor } from '@/lib/tenant'
import { listClients } from '@/lib/resources/clients'
import { CLIENT_LABELS } from '@/lib/resources/schemas'
import { deleteClient } from './actions'

function LabelBadge({ label }: { label: string | null }) {
  if (!label) return null
  const cfg = CLIENT_LABELS.find((l) => l.value === label)
  if (!cfg) return null
  return (
    <span className={`ml-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const actor = await requireActor()
  const { q } = await searchParams
  const clients = await listClients(actor, q)
  const isSuper = actor.role === 'super'

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/recursos" className="text-xs text-gray-400 hover:text-gray-600">
            ← Recursos
          </Link>
          <h1 className="text-2xl font-bold">Clientes</h1>
        </div>
        <Link
          href="/recursos/clientes/new"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-brand-600"
        >
          <PlusIcon /> Nuevo cliente
        </Link>
      </div>

      <form className="mt-5" action="/recursos/clientes" method="get">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre, RUT o contacto…"
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
        />
      </form>

      {clients.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            {q ? 'Sin resultados.' : 'Aún no hay clientes. Crea el primero.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <ClientAvatar name={c.name} logoUrl={c.logoUrl} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/recursos/clientes/${c.id}`}
                    className="font-semibold text-ink hover:text-brand-700 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <LabelBadge label={c.label ?? null} />
                    {c.portalSlug && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Portal activo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-0.5 text-xs text-gray-500">
                <p>RUT: <span className="text-gray-700">{c.rut ?? '—'}</span></p>
                <p className="truncate">Contacto: <span className="text-gray-700">{c.contact ?? c.email ?? '—'}</span></p>
                {isSuper && <p className="uppercase text-gray-400">{c.tenant.slug}</p>}
              </div>

              <div className="grid grid-cols-4 gap-1.5 border-t border-gray-100 pt-3">
                <StatPill value={c._count.tickets} label="Tickets" />
                <StatPill href={c._count.jobs ? `/flujo?cliente=${c.id}` : undefined} value={c._count.jobs} label="Trabajos" />
                <StatPill href={c._count.branches ? `/flujo/sucursales?cliente=${c.id}` : undefined} value={c._count.branches} label="Sucurs." />
                <StatPill value={c._count.assignments} label="Agenda" />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                <Link
                  href={`/recursos/clientes/${c.id}`}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Editar
                </Link>
                <DeleteButton
                  action={deleteClient.bind(null, c.id)}
                  confirmText={`¿Eliminar ${c.name}?`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClientAvatar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand text-sm font-bold text-ink">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI ya redimensionada, ver client-logo-upload.tsx
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-contain" />
      ) : (
        initials
      )}
    </div>
  )
}

function StatPill({ href, value, label }: { href?: string; value: number; label: string }) {
  const content = (
    <div className={`flex flex-col items-center rounded-md py-1.5 text-center ${href ? 'hover:bg-gray-50' : ''}`}>
      <span className={`text-sm font-bold ${value > 0 ? 'text-ink' : 'text-gray-300'}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}
