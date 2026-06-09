'use client'

import { useState } from 'react'
import type { QuoteData } from '@/lib/quotes/types'

export function DownloadPdfButton({ data }: { data: QuoteData }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/quotes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setError('No se pudo generar el PDF.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md bg-brand px-4 py-2 font-semibold text-ink transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Generando PDF…' : 'Descargar PDF'}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  )
}
