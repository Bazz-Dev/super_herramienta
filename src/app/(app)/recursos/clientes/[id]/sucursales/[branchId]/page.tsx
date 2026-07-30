import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireActor, canAccessTenant } from '@/lib/tenant'
import { BranchProfileEdit } from '@/components/resources/branch-profile-edit'
import { STATUS_LABEL, STATUS_COLOR, type TicketStatusId } from '@/lib/tickets/labels'

export default async function BranchProfilePage({
  params,
}: {
  params: Promise<{ id: string; branchId: string }>
}) {
  const actor = await requireActor()
  const { id: clientId, branchId } = await params

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true, name: true, city: true, address: true, contactName: true, contactPhone: true,
      active: true, tenantId: true, clientId: true,
      client: { select: { id: true, name: true, portalSlug: true } },
    },
  })
  if (!branch || branch.clientId !== clientId || !canAccessTenant(actor, branch.tenantId)) notFound()

  const [portalUsers, tickets] = await Promise.all([
    prisma.user.findMany({
      where: { branchId, role: 'client' },
      select: { id: true, email: true, username: true, active: true, isClientAdmin: true },
      orderBy: { email: 'asc' },
    }),
    prisma.ticket.findMany({
      where: { branchId, deletedAt: null },
      select: { id: true, ticketCode: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/recursos/clientes/${clientId}`} className="text-xs text-gray-400 hover:text-gray-600">
        ← {branch.client.name}
      </Link>
      <div className="mt-1 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{branch.name}</h1>
        {!branch.active && (
          <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500">Inactiva</span>
        )}
      </div>

      <div className="space-y-6">
        <BranchProfileEdit branch={branch} />

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            Usuarios de portal de esta sucursal ({portalUsers.length})
          </h2>
          {portalUsers.length === 0 ? (
            <p className="text-xs text-gray-400 italic">
              Sin usuarios asignados a esta sucursal todavía. Se crean desde{' '}
              <Link href={`/recursos/clientes/${clientId}`} className="text-brand-700 hover:underline">
                la ficha del cliente
              </Link>.
            </p>
          ) : (
            <div className="space-y-1">
              {portalUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${u.active ? 'text-ink' : 'text-gray-400 line-through'}`}>{u.email}</span>
                    {u.isClientAdmin && (
                      <span className="ml-1.5 rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Admin cliente</span>
                    )}
                    {u.username && <span className="ml-1.5 text-xs text-gray-400">@{u.username}</span>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Editar credenciales, crear o resetear usuarios se hace desde{' '}
            <Link href={`/recursos/clientes/${clientId}`} className="text-brand-700 hover:underline">
              la ficha del cliente
            </Link>.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-ink">Tickets de esta sucursal</h2>
          {tickets.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin tickets todavía.</p>
          ) : (
            <div className="space-y-1">
              {tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/tickets/${t.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-gray-400">{t.ticketCode}</span>{' '}
                    <span className="text-ink">{t.title}</span>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[t.status as TicketStatusId]}`}>
                    {STATUS_LABEL[t.status as TicketStatusId]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
