import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { Sidebar } from '@/components/ui/sidebar'

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
      />
      <main className="md:pl-60">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
