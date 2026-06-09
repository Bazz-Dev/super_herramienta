'use client'

import { useState } from 'react'
import { IconButton } from './ui'

export function CoverImageUpload({
  value,
  onChange,
}: {
  value?: string
  onChange: (url: string | undefined) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al subir')
      onChange(json.url as string)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <label className="cursor-pointer rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand hover:text-brand-600">
          {loading ? 'Subiendo…' : value ? 'Cambiar imagen' : 'Subir imagen HD'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
        </label>
        {value && <IconButton onClick={() => onChange(undefined)}>Quitar</IconButton>}
      </div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Portada" className="h-24 w-full rounded-md object-cover" />
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
