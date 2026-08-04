'use client'

import { useTransition } from 'react'
import { unmarkJobLegacy } from '@/app/(app)/conciliacion/actions'

// Honra lo que dice el modal de confirmación masiva ("reversible si te
// equivocas") — un trabajo marcado legado por error vuelve a SIN_TICKET,
// nunca queda atrapado.
export function UnmarkLegacyButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await unmarkJobLegacy(jobId) })}
      className="text-xs text-gray-400 hover:text-brand hover:underline disabled:opacity-50"
    >
      {isPending ? '…' : 'Deshacer'}
    </button>
  )
}
