import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { Logo } from '@/components/ui/logo'

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

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <Logo className="text-lg" />
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {user.name} ·{' '}
            <span className="font-medium uppercase">{user.tenantSlug}</span> ·{' '}
            <span className="rounded bg-brand/15 px-1.5 py-0.5 text-xs font-semibold text-brand-600">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </span>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
