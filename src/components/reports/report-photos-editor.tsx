'use client'

import { useState } from 'react'
import type { ReportPhoto } from '@/lib/reports/types'
import { fileToDataUrl } from '@/lib/quotes/image-data-url'
import { uploadDirect } from '@/lib/upload-direct'
import { previewSrc } from '@/lib/reports/resolve-preview-url'
import { PlusIcon, TrashIcon } from '@/components/quotes/icons'
import { IconButton, TextInput } from '@/components/quotes/ui'

export function ReportPhotosEditor({
  photos,
  onChange,
  clientId,
}: {
  photos: ReportPhoto[]
  onChange: (next: ReportPhoto[]) => void
  clientId?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(files: FileList) {
    setBusy(true)
    setError(null)
    try {
      const urls = clientId
        ? await Promise.all(Array.from(files).map((file) => uploadToClientDocs(file, clientId)))
        // Sin cliente todavía (informe sin ticket vinculado) no hay dónde
        // persistir en R2 — se guarda embebida como antes, caso poco común.
        : await Promise.all(Array.from(files).map(fileToDataUrl))
      onChange([...photos, ...urls.map((url) => ({ url, caption: '' }))])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-400">
        Las fotos se agregan al final del informe como “Registro fotográfico”, en su propia página.
      </p>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc(photo.url)} alt={photo.caption || 'Registro fotográfico'} className="h-24 w-full rounded object-cover" />
              <div className="mt-1.5 flex items-center gap-1">
                <TextInput
                  value={photo.caption}
                  placeholder="Pie de foto"
                  className="text-xs"
                  onChange={(e) =>
                    onChange(photos.map((p, idx) => (idx === i ? { ...p, caption: e.target.value } : p)))
                  }
                />
                <IconButton label="Quitar foto" onClick={() => onChange(photos.filter((_, idx) => idx !== i))}>
                  <TrashIcon />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-150 hover:border-brand hover:text-brand-600">
        <PlusIcon /> {busy ? 'Procesando…' : 'Agregar fotografías'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            if (e.target.files?.length) handleAdd(e.target.files)
            e.target.value = ''
          }}
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// Sube el archivo directo a R2 (misma ruta que el drag-and-drop de
// /documentos) y devuelve la key — nunca el binario embebido en el estado
// del editor, que es justo lo que terminaba mandándose por HTTP en el body
// de guardar/generar PDF.
async function uploadToClientDocs(file: File, clientId: string): Promise<string> {
  const { key } = await uploadDirect('/api/client-documents/upload-url', file, { clientId })
  return key
}
