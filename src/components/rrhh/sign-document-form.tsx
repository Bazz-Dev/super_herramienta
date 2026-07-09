'use client'

import { useState, useTransition } from 'react'
import { signDocument, rejectDocument } from '@/lib/rrhh/actions'

interface Props {
  signatureId: string
  techRut: string | null
}

export function SignDocumentForm({ signatureId, techRut }: Props) {
  const [isPending, startTransition] = useTransition()
  const [rut, setRut] = useState(techRut ?? '')
  const [rejectNote, setRejectNote] = useState('')
  const [mode, setMode] = useState<'sign' | 'reject'>('sign')
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  function handleSign(e: React.FormEvent) {
    e.preventDefault()
    if (!rut.trim()) return
    startTransition(async () => {
      try {
        await signDocument(signatureId, rut.trim())
        setResult({ ok: true, msg: 'Documento firmado correctamente.' })
      } catch (err) {
        setResult({ ok: false, msg: err instanceof Error ? err.message : 'Error al firmar' })
      }
    })
  }

  function handleReject(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await rejectDocument(signatureId, rejectNote.trim())
        setResult({ ok: true, msg: 'Documento rechazado. Se notificará al administrador.' })
      } catch (err) {
        setResult({ ok: false, msg: err instanceof Error ? err.message : 'Error al rechazar' })
      }
    })
  }

  if (result) {
    return (
      <div className={`rounded-xl border p-5 text-center ${result.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <p className={`text-sm font-semibold ${result.ok ? 'text-green-700' : 'text-red-700'}`}>{result.msg}</p>
      </div>
    )
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30'

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('sign')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === 'sign' ? 'bg-brand text-ink' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Firmar
        </button>
        <button
          onClick={() => setMode('reject')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === 'reject' ? 'bg-red-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Rechazar
        </button>
      </div>

      {mode === 'sign' ? (
        <form onSubmit={handleSign} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Confirma tu RUT para firmar
            </label>
            <input
              type="text"
              value={rut}
              onChange={e => setRut(e.target.value)}
              placeholder="12.345.678-9"
              className={inputCls}
              required
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Al confirmar tu RUT aceptas el contenido del documento y entregas tu firma electrónica simple.
            </p>
          </div>
          <button
            type="submit"
            disabled={isPending || !rut.trim()}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 disabled:opacity-50"
          >
            {isPending ? 'Firmando…' : 'Confirmar y firmar'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReject} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Motivo del rechazo (opcional)
            </label>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Explica por qué rechazas este documento…"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {isPending ? 'Procesando…' : 'Rechazar documento'}
          </button>
        </form>
      )}
    </div>
  )
}
