'use client'

import { useState } from 'react'
import type { QuoteImage } from '@/lib/quotes/types'
import { ImageIcon, PlusIcon, TrashIcon } from './icons'
import { AddButton, IconButton, TextInput } from './ui'

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/uploads', { method: 'POST', body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Error al subir la imagen')
  return json.url as string
}

export function ImagesEditor({
  coverImageUrl,
  images,
  onCoverChange,
  onImagesChange,
}: {
  coverImageUrl?: string
  images: QuoteImage[]
  onCoverChange: (url: string | undefined) => void
  onImagesChange: (next: QuoteImage[]) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCover(file: File) {
    setBusy(true)
    setError(null)
    try {
      onCoverChange(await uploadImage(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setBusy(false)
    }
  }

  async function handleAnnex(files: FileList) {
    setBusy(true)
    setError(null)
    try {
      const uploaded = await Promise.all(Array.from(files).map(uploadImage))
      onImagesChange([...images, ...uploaded.map((url) => ({ url, caption: '' }))])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cover banner */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-600">Banner de portada (opcional)</p>
        <div className="flex items-center gap-3">
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImageUrl} alt="Banner de portada" className="h-14 w-28 rounded-md object-cover" />
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-150 hover:border-brand hover:text-brand-600">
            <ImageIcon /> {busy ? 'Subiendo…' : coverImageUrl ? 'Cambiar' : 'Subir banner'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleCover(f)
                e.target.value = ''
              }}
            />
          </label>
          {coverImageUrl && (
            <IconButton label="Quitar banner" onClick={() => onCoverChange(undefined)}>
              <TrashIcon />
            </IconButton>
          )}
        </div>
      </div>

      {/* Photo annex */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-600">
          Registro fotográfico (opcional)
          <span className="ml-1 font-normal text-gray-400">— aparece como sección al final</span>
        </p>
        {images.length > 0 && (
          <div className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption || 'Imagen adjunta'} className="h-20 w-full rounded object-cover" />
                <div className="mt-1.5 flex items-center gap-1">
                  <TextInput
                    value={img.caption}
                    placeholder="Pie de foto"
                    className="text-xs"
                    onChange={(e) =>
                      onImagesChange(images.map((m, idx) => (idx === i ? { ...m, caption: e.target.value } : m)))
                    }
                  />
                  <IconButton label="Quitar imagen" onClick={() => onImagesChange(images.filter((_, idx) => idx !== i))}>
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-150 hover:border-brand hover:text-brand-600">
          <PlusIcon /> Agregar imágenes
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) handleAnnex(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
