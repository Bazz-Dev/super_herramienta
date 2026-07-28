'use client'

import { useState } from 'react'
import { Modal } from '@/components/resources/modal'

type FileType = 'ticket' | 'technician' | 'company'

function guessKind(key: string): 'pdf' | 'image' | 'other' {
  const ext = key.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image'
  return 'other'
}

// Botón que abre un modal con el archivo (PDF/imagen) en línea, en vez de
// navegar a una pestaña nueva. La URL firmada nunca se pide directo — el
// <iframe>/<img> apunta a /api/files, que valida acceso y redirige.
export function FilePreviewButton({
  fileKey, type, label = 'Ver', className,
}: {
  fileKey: string
  type: FileType
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const kind = guessKind(fileKey)
  const src = `/api/files?key=${encodeURIComponent(fileKey)}&type=${type}`
  const name = fileKey.split('/').pop() ?? 'archivo'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? 'text-xs font-semibold text-brand hover:underline'}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={name} size="lg">
        {kind === 'pdf' && <iframe src={src} title={name} className="h-[75vh] w-full rounded-md border border-gray-200" />}
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de R2, no un asset local optimizable
          <img src={src} alt={name} className="max-h-[75vh] w-full rounded-md border border-gray-200 object-contain" />
        )}
        {kind === 'other' && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-gray-300 py-10 text-center">
            <p className="text-sm text-gray-500">Vista previa no disponible para este tipo de archivo.</p>
            <a href={src} download className="text-sm font-semibold text-brand hover:underline">Descargar {name} →</a>
          </div>
        )}
      </Modal>
    </>
  )
}
