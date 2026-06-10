'use client'

import { useTransition } from 'react'
import { TrashIcon } from '@/components/quotes/icons'

// Generic delete button: receives a bound server action and confirms before running.
export function DeleteButton({
  action,
  confirmText,
}: {
  action: () => Promise<void>
  confirmText: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmText)) startTransition(() => action())
      }}
      aria-label="Eliminar"
      title="Eliminar"
      className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-gray-500 transition-colors duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
    >
      <TrashIcon />
    </button>
  )
}
