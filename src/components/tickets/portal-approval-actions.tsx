'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approvePortalTicket } from '@/app/portal/[slug]/tickets/actions'

interface Props {
  ticketId: string
  slug: string
  primary: string
}

export function PortalApprovalActions({ ticketId, slug, primary }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function handle(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !showReject) { setShowReject(true); return }
    startTransition(async () => {
      const res = await approvePortalTicket(ticketId, decision, reason.trim() || undefined)
      if (!res.success) { setError(res.error ?? 'Error al procesar'); return }
      router.refresh()
    })
  }

  const BORDER = 'rgba(24,19,14,0.15)'
  const T2 = 'rgba(24,19,14,0.55)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ background: `color-mix(in srgb, ${primary} 8%, white)`, border: `1.5px solid color-mix(in srgb, ${primary} 25%, transparent)`, borderRadius: '12px', padding: '16px 18px' }}>
        <p style={{ fontSize: '12px', fontWeight: '700', color: primary, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '4px' }}>
          ¿Apruebas esta solicitud?
        </p>
        <p style={{ fontSize: '13px', color: T2, marginBottom: '14px', lineHeight: '1.5' }}>
          Al aprobar, la solicitud pasará a INGEGAR para asignación de técnico. Al rechazar, quedará cancelada.
        </p>

        {showReject && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: T2, marginBottom: '6px' }}>
              Motivo del rechazo (opcional)
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Ej: La solicitud ya fue resuelta internamente."
              style={{ width: '100%', borderRadius: '8px', border: `1.5px solid ${BORDER}`, padding: '9px 12px', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
              autoFocus
            />
          </div>
        )}

        {error && <p style={{ fontSize: '12px', color: '#b91c1c', marginBottom: '10px' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handle('approve')}
            disabled={isPending || showReject}
            style={{
              flex: 1, padding: '10px', background: '#16a34a', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
              cursor: isPending || showReject ? 'not-allowed' : 'pointer',
              opacity: showReject ? 0.4 : isPending ? 0.7 : 1,
              fontFamily: 'Inter, sans-serif', minHeight: '40px',
            }}
          >
            ✓ Aprobar solicitud
          </button>

          {showReject ? (
            <>
              <button
                onClick={() => handle('reject')}
                disabled={isPending}
                style={{
                  flex: 1, padding: '10px', background: '#dc2626', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                  cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1,
                  fontFamily: 'Inter, sans-serif', minHeight: '40px',
                }}
              >
                {isPending ? 'Procesando…' : 'Confirmar rechazo'}
              </button>
              <button
                onClick={() => { setShowReject(false); setReason('') }}
                disabled={isPending}
                style={{
                  padding: '10px 14px', background: 'transparent', color: T2,
                  border: `1.5px solid ${BORDER}`, borderRadius: '8px',
                  fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', minHeight: '40px',
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => handle('reject')}
              disabled={isPending}
              style={{
                flex: 1, padding: '10px', background: 'transparent', color: '#b91c1c',
                border: '1.5px solid #fecaca', borderRadius: '8px',
                fontSize: '13px', fontWeight: '700', cursor: isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, sans-serif', minHeight: '40px',
              }}
            >
              ✕ Rechazar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
