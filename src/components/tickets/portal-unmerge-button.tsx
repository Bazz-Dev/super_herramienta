'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unmergeTicket } from '@/app/portal/[slug]/tickets/actions'

export function PortalUnmergeButton({ ticketId, primary }: { ticketId: string; primary: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  function handle() {
    if (!confirming) { setConfirming(true); return }
    startTransition(async () => {
      const res = await unmergeTicket(ticketId)
      if (!res.success) { setError('error' in res ? (res.error ?? 'Error al desfusionar') : 'Error al desfusionar'); return }
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {error && <p style={{ fontSize: '12px', color: '#b91c1c', margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handle}
          disabled={isPending}
          style={{
            padding: '9px 16px', background: confirming ? '#b45309' : 'transparent',
            color: confirming ? '#fff' : primary, border: `1.5px solid ${confirming ? '#b45309' : primary}`,
            borderRadius: '8px', fontSize: '13px', fontWeight: '700',
            cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1,
            fontFamily: 'Inter, sans-serif', minHeight: '40px',
          }}
        >
          {isPending ? 'Desfusionando…' : confirming ? '¿Confirmas? Sí, desfusionar' : 'Desfusionar este ticket'}
        </button>
        {confirming && !isPending && (
          <button
            onClick={() => setConfirming(false)}
            style={{
              padding: '9px 14px', background: 'transparent', color: 'var(--t2)',
              border: '1.5px solid rgba(24,19,14,0.15)', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', minHeight: '40px',
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
