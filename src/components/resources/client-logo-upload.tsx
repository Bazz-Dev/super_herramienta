'use client'

import { useRef, useState, useTransition } from 'react'
import { saveClientLogo } from '@/app/(app)/recursos/clientes/actions'

const MAX_PX = 300

interface Props {
  clientId: string
  current: string | null
}

export function ClientLogoUpload({ clientId, current }: Props) {
  const [preview, setPreview] = useState<string | null>(current)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Solo se aceptan imágenes.'); return }
    setError('')

    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, MAX_PX / Math.max(img.width, img.height))
      const w = Math.round(img.width * ratio)
      const h = Math.round(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/png')
      if (dataUrl.length > 600_000) { setError('Imagen demasiado pesada. Intenta con un PNG más pequeño.'); return }
      setPreview(dataUrl)
      setSaved(false)
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }

  function handleSave() {
    if (!preview) return
    setError('')
    startTransition(async () => {
      const res = await saveClientLogo(clientId, preview)
      if (res.error) { setError(res.error); return }
      setSaved(true)
    })
  }

  function handleRemove() {
    setPreview(null)
    setSaved(false)
    startTransition(async () => {
      await saveClientLogo(clientId, null)
    })
    if (inputRef.current) inputRef.current.value = ''
  }

  const hasChange = preview !== current

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-ink">Logo del portal</h2>
      <p className="mb-4 text-xs text-gray-400">
        Aparece en el login y sidebar del portal del cliente. PNG recomendado, cualquier tamaño.
      </p>

      <div className="flex flex-wrap items-start gap-5">
        {/* Preview */}
        <div
          className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-brand"
          onClick={() => inputRef.current?.click()}
          title="Cambiar logo"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI ya redimensionada a ≤300px por canvas, next/image no puede optimizarla más
            <img src={preview} alt="Logo preview" className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-xs text-gray-400 text-center px-2">Sin logo</span>
          )}
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onFile}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            {preview ? 'Cambiar imagen' : 'Subir logo'}
          </button>

          {preview && hasChange && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md border border-brand bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand/90 disabled:opacity-60"
            >
              {isPending ? 'Guardando…' : 'Guardar logo'}
            </button>
          )}

          {preview && !hasChange && saved && (
            <span className="text-xs font-medium text-green-700">✓ Logo guardado</span>
          )}

          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="text-xs text-red-500 hover:underline disabled:opacity-50 text-left"
            >
              Eliminar logo
            </button>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  )
}
