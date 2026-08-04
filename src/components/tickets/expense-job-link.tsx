'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setExpenseJob } from '@/app/(app)/gastos/actions'

// Vincular/desvincular un gasto directo a UN trabajo puntual (informe #14)
// — solo tiene sentido cuando el ticket tiene exactamente un Job; con 0 no
// hay a qué vincular, con 2+ sería ambiguo (nunca se adivina cuál), así que
// el caller solo renderiza esto cuando originJobs.length === 1.
export function ExpenseJobLink({ expenseId, jobId, currentJobId }: { expenseId: string; jobId: string; currentJobId: string | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const linked = currentJobId === jobId

  function toggle() {
    startTransition(async () => {
      await setExpenseJob(expenseId, linked ? null : jobId)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-50 ${
        linked ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'border border-gray-300 text-gray-500 hover:bg-gray-100'
      }`}
    >
      {isPending ? '…' : linked ? 'Vinculado al trabajo ✓' : 'Vincular a trabajo'}
    </button>
  )
}
