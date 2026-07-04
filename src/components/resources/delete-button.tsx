'use client'

import { useTransition } from 'react'
import { TrashIcon } from '@/components/quotes/icons'
import { Spinner } from '@/components/ui/spinner'

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
      className="inline-flex min-h-11 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-gray-500 transition-colors duration-150 hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-40"
    >
      {pending ? <Spinner size={14} /> : <TrashIcon />}
    </button>
  )
}
