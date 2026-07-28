import Link from 'next/link'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

// Shared filter-row primitives. Before this, tickets/rrhh/recursos each
// hand-rolled their own `<select className="rounded-md border...">` with
// slightly different padding/height — this is the one place that decides
// what a filter control looks like. Layout only: filter STATE (URL params,
// useState) stays with the page, this just gives it a consistent shell.
//
// Usage: <FilterBar action={<Button>+ Nuevo</Button>}>
//          <FilterSearch .../> <FilterSelect>...</FilterSelect> <FilterPill .../>
//        </FilterBar>

const CONTROL =
  'interactive min-h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30'

export function FilterBar({
  children,
  action,
  className,
}: {
  children: ReactNode
  /** Right-aligned primary CTA — "+ Nuevo ticket", "Exportar", etc. Optional: some pages keep their CTA in the page header instead. */
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm', className)}>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function FilterSelect({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL, 'cursor-pointer', className)} {...rest} />
}

/** Search input with a leading magnifier icon, sized to not hog the row on wide filter bars. */
export function FilterSearch({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative min-w-45 max-w-xs flex-1">
      <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 9l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input className={cn(CONTROL, 'w-full pl-8', className)} {...rest} />
    </div>
  )
}

const PILL_TONE = {
  // Default status/tipo pill — dark fill when active, matches ticket kanban pills.
  neutral: { active: 'bg-ink text-white', inactive: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  // For a pill that flags something needing attention (e.g. "sin asignar") —
  // amber even when inactive, so it stands out from ordinary status filters.
  warn: { active: 'bg-amber-500 text-white', inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
} as const

/** Toggle pill for an "estado" filter (status/tipo groups) — active state uses the same dark fill everywhere instead of each page picking its own. */
export function FilterPill({
  active,
  onClick,
  href,
  tone = 'neutral',
  className,
  children,
}: {
  active: boolean
  onClick?: () => void
  href?: string
  tone?: keyof typeof PILL_TONE
  className?: string
  children: ReactNode
}) {
  const cls = cn(
    'interactive inline-flex min-h-9 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition-colors',
    active ? PILL_TONE[tone].active : PILL_TONE[tone].inactive,
    className,
  )
  if (href) return <Link href={href} className={cls}>{children}</Link>
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}

/** "Limpiar filtros" — only render when a filter is actually active (caller decides). */
export function FilterClear({ onClick, href }: { onClick?: () => void; href?: string }) {
  const cls = cn(CONTROL, 'text-gray-500 hover:bg-gray-50')
  if (href) return <Link href={href} className={cls}>× Limpiar filtros</Link>
  return (
    <button type="button" onClick={onClick} className={cls}>
      × Limpiar filtros
    </button>
  )
}
