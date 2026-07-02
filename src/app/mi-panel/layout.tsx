import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/ui/logo'
import { NotificationBell } from '@/components/ui/notification-bell'

export default async function MiPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'tecnico') redirect('/dashboard')

  const logout = (
    <form
      action={async () => {
        'use server'
        await signOut({ redirectTo: '/login' })
      }}
    >
      <button
        type="submit"
        className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Salir
      </button>
    </form>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <Link href="/mi-panel" aria-label="Mi panel">
          <Logo className="text-xl" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-gray-500">{session.user.name}</span>
          <NotificationBell />
          {logout}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        {children}
      </main>
    </div>
  )
}
