'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addPortalComment } from '@/app/portal/[slug]/tickets/actions'

interface Props {
  ticketId: string
  primary: string
}

export function PortalCommentForm({ ticketId, primary }: Props) {
  const [text, setText] = useState('')
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setError('')
    startTransition(async () => {
      const res = await addPortalComment(ticketId, text)
      if (!res.success) { setError('Error al enviar el comentario. Inténtalo nuevamente.'); return }
      setText('')
      setSent(true)
      router.refresh()
      setTimeout(() => setSent(false), 3000)
    })
  }

  return (
    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--p-bd)' }}>
      <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Agregar comentario
      </p>
      <form onSubmit={handleSubmit} className="pcomment-form">
        <textarea
          ref={ref}
          className="pcomment-input"
          placeholder="Escribe una actualización, pregunta o información adicional para el equipo técnico…"
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={isPending}
          rows={3}
        />
        {error && (
          <p style={{ fontSize: '12px', color: '#b91c1c', background: '#fef2f2', padding: '8px 12px', borderRadius: '7px' }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={isPending || !text.trim()}
            style={{
              padding: '9px 20px', background: primary, color: '#fff',
              border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '700',
              cursor: isPending || !text.trim() ? 'not-allowed' : 'pointer',
              opacity: isPending || !text.trim() ? 0.5 : 1,
              fontFamily: 'inherit', transition: 'opacity 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {isPending ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M7 2v3M7 9v3M2 7h3M9 7h3M3.6 3.6l2.1 2.1M8.3 8.3l2.1 2.1M3.6 10.4l2.1-2.1M8.3 5.7l2.1-2.1"/>
                </svg>
                Enviando…
              </>
            ) : 'Enviar comentario →'}
          </button>
          {sent && (
            <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 7l3.5 3.5L12 3.5"/>
              </svg>
              Comentario enviado
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
