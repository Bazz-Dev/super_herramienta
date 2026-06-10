'use client'

import { useState } from 'react'
import type { QuoteData } from '@/lib/quotes/types'
import { DownloadIcon } from './icons'
import { Button } from './ui'

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
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Button onClick={handleClick} disabled={loading} aria-busy={loading}>
        <DownloadIcon />
        {loading ? 'Generando…' : 'Descargar PDF'}
      </Button>
    </div>
  )
}
