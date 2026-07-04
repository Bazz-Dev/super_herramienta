'use client'

import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui/spinner'

const inputBase =
  'w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-ink placeholder:text-gray-400 outline-none transition-colors duration-150 focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className ?? ''}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-y ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} cursor-pointer bg-white ${props.className ?? ''}`} />
}

export function NumberInput({
  value,
  onValue,
  ...rest
}: { value: number; onValue: (n: number) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
>) {
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onValue(e.target.value === '' ? 0 : Number(e.target.value))}
      className={`${inputBase} text-right ${rest.className ?? ''}`}
    />
  )
}

/** Icon-only button. `label` is required for accessibility (aria-label + title). */
export function IconButton({
  children,
  label,
  ...rest
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className="interactive inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-gray-500 transition-colors duration-150 hover:bg-gray-50 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function AddButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-150 hover:border-brand hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {children}
    </button>
  )
}

export function Button({
  children,
  variant = 'primary',
  'aria-busy': ariaBusy,
  ...rest
}: { variant?: 'primary' | 'ghost' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isLoading = ariaBusy === true || ariaBusy === 'true'
  const styles =
    variant === 'primary'
      ? 'bg-brand text-ink hover:bg-brand-600'
      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
  return (
    <button
      type="button"
      aria-busy={ariaBusy}
      {...rest}
      className={`interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${rest.className ?? ''}`}
    >
      {isLoading && <Spinner size={14} />}
      {children}
    </button>
  )
}

export function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        {icon && <span className="mt-0.5 text-brand-600">{icon}</span>}
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}
