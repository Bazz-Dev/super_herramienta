import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { Logo } from '@/components/ui/logo'
import { AppNav } from '@/components/ui/app-nav'

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
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2.5">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" aria-label="Ir al inicio">
              <Logo className="text-lg" />
            </Link>
            <AppNav />
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-gray-600 sm:inline">
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
                className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
