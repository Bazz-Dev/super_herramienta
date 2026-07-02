'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './logo'
import { NotificationBell } from './notification-bell'

const NAV_SECTIONS = [
  {
    label: null,
    links: [
      { href: '/dashboard', label: 'Inicio', icon: HomeIcon },
    ],
  },
  {
    label: 'Operaciones',
    links: [
      { href: '/cronograma', label: 'Cronograma', icon: CalendarIcon },
      { href: '/tickets', label: 'Tickets', icon: TicketIcon },
    ],
  },
  {
    label: 'Comercial',
    links: [
      { href: '/cotizador', label: 'Propuestas', icon: DocIcon },
      { href: '/informe', label: 'Informes', icon: ReportIcon },
      { href: '/documentos', label: 'Carpetas clientes', icon: FolderIcon },
      { href: '/flujo', label: 'Flujo de Caja', icon: CashIcon },
    ],
  },
  {
    label: 'RR.HH.',
    links: [
      { href: '/rrhh', label: 'Personas', icon: PeopleIcon },
      { href: '/rrhh/vacaciones', label: 'Permisos', icon: CalendarCheckIcon },
      { href: '/rrhh/liquidaciones', label: 'Liquidaciones', icon: PayrollIcon },
    ],
  },
  {
    label: 'Recursos',
    links: [
      { href: '/recursos', label: 'Inventario', icon: ToolsIcon },
      { href: '/gastos', label: 'Gastos', icon: ReceiptIcon },
    ],
  },
]

export function Sidebar({
  user,
  logout,
  portalClients = [],
}: {
  user: { name: string; tenantSlug: string; roleLabel: string }
  logout: ReactNode
  portalClients?: { name: string; portalSlug: string }[]
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const content = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-4">
        <Link href="/dashboard" onClick={() => setOpen(false)} aria-label="Ir al inicio">
          <Logo className="text-xl" />
        </Link>
        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-400">Sistema interno</p>
      </div>

      <nav className="flex flex-1 flex-col gap-4 px-3 overflow-y-auto">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.label && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {section.label}
              </p>
            )}
            {section.links.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    active ? 'bg-brand text-ink shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-ink'
                  }`}
                >
                  <Icon />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}

        {portalClients.length > 0 && (
          <div>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Portales cliente
            </p>
            {portalClients.map(({ name, portalSlug }) => {
              const href = `/portal/${portalSlug}/tickets`
              const active = isActive(`/portal/${portalSlug}`)
              return (
                <a
                  key={portalSlug}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    active ? 'bg-brand text-ink shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-ink'
                  }`}
                >
                  <PortalIcon />
                  {name}
                </a>
              )
            })}
          </div>
        )}
      </nav>

      <div className="border-t border-gray-200 px-5 py-4 text-sm">
        <a href="/perfil" className="group flex items-center gap-2 hover:opacity-80">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-ink">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink group-hover:text-brand">{user.name}</p>
            <p className="truncate text-xs text-gray-500">
              <span className="uppercase">{user.tenantSlug}</span> · {user.roleLabel}
            </p>
          </div>
        </a>
        <div className="mt-3">{logout}</div>
        <p className="mt-3 text-center text-[10px] font-mono text-gray-300">INGEGAR One · v1.8.0</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 md:hidden">
        <Link href="/dashboard" aria-label="Ir al inicio">
          <Logo className="text-lg" />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="cursor-pointer rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
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
function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  )
}
function ReportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 2h6l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M14 2v4h4M8 13l2 2 3-4M8 18h6" />
    </svg>
  )
}
function ToolsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 0 5 5l-9 9a2.8 2.8 0 0 1-4-4Z" />
      <path d="m18 2 4 4-3 1-2-2Z" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </svg>
  )
}
function CashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  )
}
function UserCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="9" r="3"/>
      <path d="M6.168 18.849A4 4 0 0110 16h4a4 4 0 013.834 2.855"/>
    </svg>
  )
}
function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
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
function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2M13 17v2M13 11v2" />
    </svg>
  )
}
function PortalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9M3 12h18" />
    </svg>
  )
}
function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function CalendarCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M3 10h18M8 2v4M16 2v4M9 16l2 2 4-4"/>
    </svg>
  )
}
function PayrollIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/>
      <path d="M14 3v5h5M9 12h6M9 16h4"/>
      <circle cx="9" cy="9" r="1" fill="currentColor"/>
    </svg>
  )
}
function ReceiptIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  )
}
