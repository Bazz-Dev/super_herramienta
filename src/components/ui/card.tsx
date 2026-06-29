import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a colored top stripe (brand/ok/warn/danger/info) */
  accent?: 'brand' | 'ok' | 'warn' | 'danger' | 'info'
  children: ReactNode
}

const ACCENT: Record<NonNullable<CardProps['accent']>, string> = {
  brand:  'border-t-2 border-t-brand',
  ok:     'border-t-2 border-t-ok-500',
  warn:   'border-t-2 border-t-warn-500',
  danger: 'border-t-2 border-t-danger-500',
  info:   'border-t-2 border-t-info-500',
}

export function Card({ accent, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md',
        accent && ACCENT[accent],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-start justify-between gap-3 p-4 pb-0', className)} {...props}>
      {children}
    </div>
  )
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-4 py-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2 border-t border-gray-100 px-4 py-3', className)} {...props}>
      {children}
    </div>
  )
}
