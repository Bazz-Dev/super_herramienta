import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import Link from 'next/link'
import { NewTicketForm } from '@/components/tickets/new-ticket-form'

export const metadata = { title: 'Nuevo ticket — INGEGAR' }

export default async function NewTicketPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const actor = { id: session.user.id, tenantId: session.user.tenantId, role: session.user.role }

  const [clients, users] = await Promise.all([
    prisma.client.findMany({
      where: tenantScope(actor),
      select: { id: true, name: true, portalSlug: true, branches: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { ...tenantScope(actor), role: { in: ['super', 'supervisor', 'tecnico'] }, active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/tickets" className="text-sm text-gray-400 hover:text-brand transition">
          ← Tickets
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-ink">Nuevo ticket</h1>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <NewTicketForm
          clients={clients}
          users={users}
          createdById={actor.id}
        />
      </div>
    </div>
  )
}
