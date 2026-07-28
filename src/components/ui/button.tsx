import Link from 'next/link'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

// Canonical button primitive — every "primary action" surface in the app
// (page-header CTAs, form submits, card actions) should route through this
// instead of hand-rolling `rounded-md bg-brand px-3 py-2 ...` again, which is
// how the same semantic button ended up with 3 slightly different looks
// across técnicos/clientes ("+ Nuevo") vs tickets ("+ Nuevo ticket").
const VARIANT: Record<ButtonVariant, string> = {
  primary:   'bg-brand text-ink hover:bg-brand-600',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  danger:    'border border-danger-100 bg-danger-50 text-danger-700 hover:bg-danger-100',
  ghost:     'text-gray-600 hover:bg-gray-100',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-2.5 py-1.5 text-xs gap-1',
  md: 'min-h-11 px-3 py-2.5 text-sm gap-1.5',
}

const BASE =
  'interactive inline-flex cursor-pointer items-center justify-center rounded-md font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60'

// Exported so non-Button elements that need identical styling (e.g. a real
// <a download> / <a target="_blank">, which Button's Link-only `href` can't
// express) can stay visually identical without a second button implementation.
export function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn(BASE, VARIANT[variant], SIZE[size], className)
}

type Props = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Renders as a Next Link styled like a button — for page-header CTAs that navigate instead of submit. */
  href?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  'aria-busy': ariaBusy,
  className,
  ...rest
}: Props) {
  const isLoading = ariaBusy === true || ariaBusy === 'true'
  const cls = buttonClass(variant, size, className)

  if (href) {
    return (
      <Link href={href} className={cls} aria-busy={ariaBusy}>
        {isLoading && <Spinner size={14} />}
        {children}
      </Link>
    )
  }

  return (
    <button type="button" aria-busy={ariaBusy} {...rest} className={cls}>
      {isLoading && <Spinner size={14} />}
      {children}
    </button>
  )
}
