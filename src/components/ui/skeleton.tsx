import { cn } from '@/lib/cn'

// Base skeleton block — every `loading.tsx` in the app already hand-rolls
// `animate-pulse rounded bg-gray-200` divs; this just names that pattern so
// new loading states don't have to remember the exact classes.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-gray-200', className)} />
}
