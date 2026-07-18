import Link from 'next/link'
import { signOut } from '@/auth'
import { requireActor } from '@/lib/tenant'
import { Logo } from '@/components/ui/logo'
import { NotificationBell } from '@/components/ui/notification-bell'

export default async function MiPanelLayout({ children }: { children: React.ReactNode }) {
  // requireActor() redirects to /login when unauthenticated. Uses the same
  // real-or-impersonated role gate as the rest of the técnico panel (G30) —
  // a raw session.user.role check here would bypass "ver como" entirely.
  const actor = await requireActor(['tecnico'])

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
        <div className="flex items-center gap-4">
          <Link href="/mi-panel" aria-label="Mi panel">
            <Logo className="text-xl" />
          </Link>
          <Link href="/mi-panel/tickets" className="text-sm font-semibold text-gray-600 transition hover:text-brand">
            Mis tickets
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-gray-500">{actor.viewingAsName ?? actor.name}</span>
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
