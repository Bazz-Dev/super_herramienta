'use client'

import type { ReactNode } from 'react'

const inputBase =
  'w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

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
  return <textarea {...props} className={`${inputBase} ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} bg-white ${props.className ?? ''}`} />
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
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onValue(e.target.value === '' ? 0 : Number(e.target.value))}
      className={`${inputBase} ${rest.className ?? ''}`}
    />
  )
}

export function IconButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
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
      className="rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand-600"
    >
      {children}
    </button>
  )
}

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  )
}
