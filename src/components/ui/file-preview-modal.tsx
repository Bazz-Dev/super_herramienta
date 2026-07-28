'use client'

import { useState } from 'react'
import { Modal } from '@/components/resources/modal'
import { buttonClass } from './button'
import { EmptyState } from './empty-state'

export type FileEntityType = 'ticket' | 'technician' | 'company'
export type FilePreviewMeta = { label: string; value: string }

function guessKind(nameOrKey: string): 'pdf' | 'image' | 'other' {
  const ext = nameOrKey.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image'
  return 'other'
}

// ponytail: mirrors src/lib/r2.ts:isR2Key exactly. Not imported directly —
// r2.ts pulls in @aws-sdk/client-s3, which must stay server-only and would
// bloat/break the client bundle if this file imported it.
function isR2FileUrl(fileUrl: string): boolean {
  return fileUrl !== 'inline' && !fileUrl.startsWith('/') && !fileUrl.startsWith('http')
}

/** Resolves a raw DB `fileUrl` to a browser-loadable src: through the signed /api/files proxy for R2 keys, direct otherwise (legacy public path/URL). */
export function resolveFileSrc(fileUrl: string, type: FileEntityType): string {
  return isR2FileUrl(fileUrl) ? `/api/files?key=${encodeURIComponent(fileUrl)}&type=${type}` : fileUrl
}

/**
 * Universal "Ver" trigger for any stored document (ticket/técnico/empresa) —
 * opens an in-app modal with metadata + inline preview instead of navigating
 * away. This is the ONE place preview UX lives; every doc listing should
 * route "Ver" through this instead of a bespoke modal or a raw <a target=_blank>.
 */
export function FilePreviewButton({
  fileUrl, type, name, meta = [], label = 'Ver', className,
}: {
  fileUrl: string
  type: FileEntityType
  /** Display name — defaults to the last path segment of fileUrl. */
  name?: string
  /** Rows shown above the preview: categoría, dueño/entidad, fechas, etc. */
  meta?: FilePreviewMeta[]
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const displayName = name || fileUrl.split('/').pop() || 'archivo'
  // Guess from fileUrl (the real key, e.g. "technicians/x/y.png"), NOT
  // displayName — that's a human label ("Contrato") with no extension.
  const kind = guessKind(fileUrl)
  const src = resolveFileSrc(fileUrl, type)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? 'text-xs font-semibold text-brand hover:underline'}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={displayName} size="lg">
        {meta.length > 0 && (
          <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-gray-50 px-3 py-2.5 text-xs sm:grid-cols-4">
            {meta.map((m) => (
              <div key={m.label} className="min-w-0">
                <dt className="text-gray-400">{m.label}</dt>
                <dd className="truncate font-medium text-ink">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {kind === 'pdf' && <iframe src={src} title={displayName} className="h-[70vh] w-full rounded-md border border-gray-200" />}
        {kind === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de R2, no un asset local optimizable
          <img src={src} alt={displayName} className="max-h-[70vh] w-full rounded-md border border-gray-200 object-contain" />
        )}
        {kind === 'other' && (
          <EmptyState
            title="Vista previa no disponible"
            description="Este tipo de archivo no se puede previsualizar en el navegador — descárgalo para verlo."
          />
        )}

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
          <button type="button" onClick={() => setOpen(false)} className={buttonClass('ghost', 'sm')}>
            Cerrar
          </button>
          <a href={src} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
            Abrir original ↗
          </a>
          <a href={src} download={displayName} className={buttonClass('primary', 'sm')}>
            Descargar
          </a>
        </div>
      </Modal>
    </>
  )
}
