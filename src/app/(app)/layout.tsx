import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { tenantScope } from '@/lib/tenant'
import { Sidebar } from '@/components/ui/sidebar'
import { NotificationBell } from '@/components/ui/notification-bell'

const ROLE_LABELS: Record<string, string> = {
  super: 'Super',
  supervisor: 'Supervisor',
  client: 'Cliente',
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { user } = session

  // Clients belong in the portal, not the internal app
  if (user.role === 'client') {
    const clientRecord = user.clientId
      ? await prisma.client.findUnique({ where: { id: user.clientId }, select: { portalSlug: true } })
      : null
    redirect(clientRecord?.portalSlug ? `/portal/${clientRecord.portalSlug}/tickets` : '/login')
  }

  const portalClients = await prisma.client.findMany({
    where: { ...tenantScope(user), portalSlug: { not: null } },
    select: { name: true, portalSlug: true },
    orderBy: { name: 'asc' },
  }) as { name: string; portalSlug: string }[]

  const logout = (
    <form
      action={async () => {
        'use server'
        await signOut({ redirectTo: '/login' })
      }}
    >
      <button
        type="submit"
        className="w-full cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Salir
      </button>
    </form>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        user={{
          name: user.name ?? 'Usuario',
          tenantSlug: user.tenantSlug,
          roleLabel: ROLE_LABELS[user.role] ?? user.role,
        }}
        logout={logout}
        portalClients={portalClients}
      />
      <main className="md:pl-60">
        {/* Topbar with notification bell */}
        <div className="sticky top-0 z-30 hidden items-center justify-end border-b border-gray-200 bg-white/90 px-6 py-2 backdrop-blur md:flex">
          <NotificationBell />
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
