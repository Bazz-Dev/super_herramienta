import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The 5 *semantic* tones — outcome/meaning, not category. Reserve these for
 * "this is good/bad/pending/informational", the same vocabulary as the
 * ok/warn/danger/info tokens in globals.css. A purely categorical distinction
 * (kanban stage color, contract type, ticket urgency) is NOT a semantic tone
 * — pass explicit Tailwind classes via `className` for those instead of
 * forcing a 6th meaning onto this list.
 */
export type BadgeTone = 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

const TONE: Record<BadgeTone, string> = {
  brand:   'bg-brand/15 text-brand-600',
  ok:      'bg-ok-100 text-ok-700',
  warn:    'bg-warn-100 text-warn-700',
  danger:  'bg-danger-100 text-danger-700',
  info:    'bg-info-100 text-info-700',
  neutral: 'bg-gray-100 text-gray-600',
}

const DOT_TONE: Record<BadgeTone, string> = {
  brand: 'bg-brand', ok: 'bg-ok-500', warn: 'bg-warn-500', danger: 'bg-danger-500', info: 'bg-info-500', neutral: 'bg-gray-400',
}

export function Badge({
  tone, dot, children, className,
}: { tone?: BadgeTone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', tone && TONE[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone ? DOT_TONE[tone] : 'bg-current')} />}
      {children}
    </span>
  )
}

/** Standalone colored dot with no pill/background — for legends and dense list rows. */
export function StatusDot({ tone = 'neutral', className }: { tone?: BadgeTone; className?: string }) {
  return <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', DOT_TONE[tone], className)} />
}
