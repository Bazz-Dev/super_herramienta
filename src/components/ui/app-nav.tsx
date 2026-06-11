'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/cotizador', label: 'Propuestas' },
  { href: '/recursos', label: 'Recursos' },
  { href: '/cronograma', label: 'Cronograma' },
]

export function AppNav() {
  const pathname = usePathname()
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`)
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              active ? 'bg-brand/15 text-brand-600' : 'text-gray-600 hover:bg-gray-50 hover:text-ink'
            }`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
