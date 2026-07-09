'use client'

import { useState, useTransition } from 'react'
import { requestLeaveAsTecnico } from '@/lib/rrhh/actions'

const TYPE_LABELS: Record<string, string> = {
  vacaciones:        'Vacaciones',
  permiso_sin_goce:  'Permiso sin goce',
  permiso_con_goce:  'Permiso con goce',
  licencia_medica:   'Licencia médica',
  otro:              'Otro permiso',
}

function countBusinessDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  if (e < s) return 0
  let count = 0
  const d = new Date(s)
  while (d <= e) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

export function TecnicoLeaveForm() {
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState('vacaciones')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const days = countBusinessDays(startDate, endDate)

  function reset() {
    setType('vacaciones')
    setStartDate('')
    setEndDate('')
    setNote('')
    setStatus('idle')
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('idle')
    startTransition(async () => {
      try {
        await requestLeaveAsTecnico({ type, startDate, endDate, days, note: note || undefined })
        reset()
        setStatus('ok')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Error al enviar solicitud')
        setStatus('error')
      }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Tipo de permiso</label>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          required
        >
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setStatus('idle') }}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setStatus('idle') }}
            min={startDate || undefined}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            required
          />
        </div>
      </div>

      {days > 0 && (
        <p className="text-xs text-gray-500">
          {days} día{days !== 1 ? 's' : ''} hábil{days !== 1 ? 'es' : ''}
        </p>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Nota <span className="text-gray-400">(opcional)</span>
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          placeholder="Motivo u observación"
        />
      </div>

      {status === 'ok' && (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          Solicitud enviada — el supervisor revisará tu pedido.
        </p>
      )}
      {status === 'error' && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || days === 0}
        className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brand/90 disabled:opacity-50"
      >
        {isPending ? 'Enviando…' : 'Solicitar permiso'}
      </button>
    </form>
  )
}
