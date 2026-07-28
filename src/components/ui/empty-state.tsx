import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// Shared empty/no-results/first-use state — dashed border reads as "nothing
// here yet" (vs. a solid-border Card, which reads as "here's real content").
export function EmptyState({
  icon, title, description, action, className,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center', className)}>
      {icon && <div className="mb-1 text-gray-300">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-xs text-gray-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
