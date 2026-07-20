'use client'

import { useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Logo } from './logo'
import { NotificationBell } from './notification-bell'

const NAV_LINKS = [
  { href: '/mi-panel', label: 'Inicio', icon: HomeIcon },
  { href: '/mi-panel/tickets', label: 'Mis tickets', icon: TicketIcon },
  { href: '/mi-panel/agenda', label: 'Mi agenda', icon: CalendarIcon },
  { href: '/mi-panel/gastos', label: 'Gastos', icon: ExpenseIcon },
  { href: '/mi-panel/rrhh', label: 'RR.HH.', icon: RrhhIcon },
]

export function MiPanelSidebar({
  userName,
  logout,
  isViewingAs = false,
  agendaCount = 0,
}: {
  userName: string
  logout: ReactNode
  // true cuando un super está impersonando a este técnico vía "ver como" —
  // muestra un banner para salir y volver a /dashboard como admin.
  isViewingAs?: boolean
  // Trabajos agendados (programados/en curso) — badge en "Mi agenda", en vez
  // de un KPI mudo en Inicio que no distinguía qué requiere atención.
  agendaCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [exiting, startExit] = useTransition()
  // '/mi-panel' es el root y prefijo de todas las sub-rutas — match exacto
  // solo para él, si no "Inicio" queda resaltado en cualquier otra página.
  const isActive = (href: string) => href === '/mi-panel' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  function exitViewAs() {
    startExit(async () => {
      await fetch('/api/auth/view-as', { method: 'DELETE' })
      router.push('/dashboard')
    })
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-4">
        <Link href="/mi-panel" onClick={() => setOpen(false)} aria-label="Mi panel">
          <Logo className="text-xl" />
        </Link>
        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">Mi Panel</p>
      </div>

      {isViewingAs && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
          <span aria-hidden>👁</span>
          <span className="flex-1 truncate font-medium">Viendo como técnico</span>
          <button
            onClick={exitViewAs}
            disabled={exiting}
            className="rounded px-1 font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
            title="Salir de vista como"
            aria-label="Salir de vista como"
          >
            ×
          </button>
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          const badge = href === '/mi-panel/agenda' ? agendaCount : 0
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`interactive flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-150 ${
                active ? 'bg-brand text-ink shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-ink'
              }`}
            >
              <Icon />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-ink/15 text-ink' : 'bg-brand text-ink'
                }`}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="safe-b border-t border-gray-200 px-5 py-4 text-sm">
        <div className="flex min-h-11 items-center gap-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-ink">
            {userName.charAt(0).toUpperCase()}
          </div>
          <p className="min-w-0 truncate font-medium text-ink">{userName}</p>
        </div>
        <div className="mt-3">{logout}</div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 md:hidden">
        <Link href="/mi-panel" aria-label="Mi panel" className="flex min-h-11 items-center">
          <Logo className="text-lg" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="interactive flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">{content}</aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-gray-200 bg-white md:block">
        {content}
      </aside>
    </>
  )
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}
function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2M13 17v2M13 11v2" />
    </svg>
  )
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </svg>
  )
}
function ExpenseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.5 1.5-2 3-2s3 .7 3 2-1.5 2-3 2-3 .5-3 2 1.5 2 3 2 3-.5 3-2" />
    </svg>
  )
}
function RrhhIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21V8a2 2 0 0 1 2-2h5v15" />
      <path d="M11 21V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v17" />
      <path d="M7 10h1M7 14h1M14 8h1M14 12h1M14 16h1" />
    </svg>
  )
}
