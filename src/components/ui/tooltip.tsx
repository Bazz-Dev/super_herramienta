'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Lightweight tooltip — CSS-only (group-hover/group-focus-within), no
 * dependency, no dynamic positioning engine. There's no real case yet where
 * it clips against a viewport edge; if that shows up, that's when a
 * positioning lib earns its keep, not before.
 * Triggers on hover AND keyboard focus so it's usable without a mouse —
 * the trigger wrapper is what needed a real primitive (see
 * auto-filled-badge.tsx, which used to fall back to the native `title`
 * attribute for exactly this).
 */
export function Tooltip({
  content, children, side = 'top', className,
}: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom'; className?: string }) {
  const id = useId()
  return (
    <span className={cn('group relative inline-flex', className)}>
      <span aria-describedby={id} tabIndex={0} className="inline-flex focus-visible:outline-none">
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute left-1/2 z-30 w-max max-w-56 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  )
}
