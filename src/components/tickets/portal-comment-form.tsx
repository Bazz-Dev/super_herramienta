'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addPortalComment } from '@/app/portal/[slug]/tickets/actions'

interface Props {
  ticketId: string
  primary: string
  inline?: boolean
}

const ACCEPT = 'image/*,video/mp4,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx'
const MAX_FILE_MB = 50

type UploadedFile = { key: string; name: string; mimeType: string }

async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const results: UploadedFile[] = []
  for (const file of files) {
    const res = await fetch('/api/portal-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, mimeType: file.type || 'application/octet-stream' }),
    })
    if (!res.ok) throw new Error(`Error al preparar subida de ${file.name}`)
    const { url, key } = await res.json()
    const putRes = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    if (!putRes.ok) throw new Error(`Error al subir ${file.name}`)
    results.push({ key, name: file.name, mimeType: file.type })
  }
  return results
}

export function PortalCommentForm({ ticketId, primary, inline }: Props) {
  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    const oversized = picked.filter(f => f.size > MAX_FILE_MB * 1024 * 1024)
    if (oversized.length) { setError(`Archivo demasiado grande. Máximo ${MAX_FILE_MB} MB.`); return }
    setPendingFiles(prev => [...prev, ...picked])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(i: number) {
    setPendingFiles(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() && pendingFiles.length === 0) return
    setError('')
    startTransition(async () => {
      let uploaded: UploadedFile[] = []
      if (pendingFiles.length > 0) {
        try {
          uploaded = await uploadFiles(pendingFiles)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al subir archivos')
          return
        }
      }
      const res = await addPortalComment(ticketId, text, uploaded.length > 0 ? uploaded : undefined)
      if (!res.success) { setError('Error al enviar el comentario. Inténtalo nuevamente.'); return }
      setText('')
      setPendingFiles([])
      setSent(true)
      router.refresh()
      setTimeout(() => setSent(false), 3000)
    })
  }

  const hasContent = text.trim().length > 0 || pendingFiles.length > 0

  return (
    <div style={inline ? {} : { marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--p-bd)' }}>
      {!inline && (
        <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--p-t2)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Agregar comentario
        </p>
      )}
      <form onSubmit={handleSubmit} className="pcomment-form">
        <textarea
          ref={textRef}
          className="pcomment-input"
          placeholder="Escribe una actualización, pregunta o información adicional para el equipo técnico…"
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={isPending}
          rows={3}
        />

        {/* Selected files */}
        {pendingFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
            {pendingFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 9px', background: `color-mix(in srgb, ${primary} 6%, white)`, borderRadius: '7px', border: `1px solid color-mix(in srgb, ${primary} 18%, transparent)` }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke={primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12.5h8a1 1 0 001-1V4L9.5 1.5H3a1 1 0 00-1 1v9a1 1 0 001 1z"/><path d="M9.5 1.5V4H12"/></svg>
                <span style={{ fontSize: '11px', color: 'var(--p-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <button type="button" onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--p-t3)', fontSize: '15px', lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p style={{ fontSize: '12px', color: '#b91c1c', background: '#fef2f2', padding: '8px 12px', borderRadius: '7px' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={isPending || !hasContent}
            style={{
              padding: '9px 20px', background: primary, color: '#fff',
              border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: '700',
              cursor: isPending || !hasContent ? 'not-allowed' : 'pointer',
              opacity: isPending || !hasContent ? 0.5 : 1,
              fontFamily: 'inherit', transition: 'opacity 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {isPending ? 'Enviando…' : 'Enviar →'}
          </button>

          {/* File attach button */}
          <input ref={fileRef} type="file" multiple accept={ACCEPT} onChange={handleFilePick}
            style={{ display: 'none' }} aria-label="Adjuntar archivo al comentario" />
          <button type="button" onClick={() => fileRef.current?.click()}
            disabled={isPending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '9px 14px', background: 'transparent', border: '1.5px solid var(--p-bd)', borderRadius: '9px', fontSize: '12px', fontWeight: '600', color: 'var(--p-t2)', cursor: 'pointer', fontFamily: 'inherit' }}
            title="Adjuntar archivo">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 7.5L7 14a3.5 3.5 0 01-4.95-4.95l6.5-6.5a2.33 2.33 0 013.3 3.3L5.3 12.4a1.17 1.17 0 01-1.65-1.65L9.5 5"/></svg>
            Adjuntar
          </button>

          {sent && (
            <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l3.5 3.5L12 3.5"/></svg>
              Enviado
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
