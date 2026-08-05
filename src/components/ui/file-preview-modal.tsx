'use client'

import { useState, type ReactNode } from 'react'
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
  /** Trigger content — texto por defecto, pero acepta un ícono (ver conciliacion/doc-status-icon.tsx). */
  label?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)
  const displayName = name || fileUrl.split('/').pop() || 'archivo'
  // Guess from fileUrl (the real key, e.g. "technicians/x/y.png"), NOT
  // displayName — that's a human label ("Contrato") with no extension.
  const kind = guessKind(fileUrl)
  const src = resolveFileSrc(fileUrl, type)

  // Bug real reportado en vivo ("el visor da 404 en algunos lugares, ej.
  // documentos de técnicos"): reproducido contra el espejo local — un
  // fileUrl en DB puede apuntar a una key que ya no existe en R2 (objeto
  // borrado por fuera de la app). Antes el <iframe>/<img> apuntaba directo a
  // `src`, así que el usuario veía el XML crudo de R2 ("NoSuchKey") o un
  // ícono de imagen rota dentro del modal. Chequeo barato (HEAD, sin bajar
  // bytes) al abrir, antes de prometer un preview que va a fallar.
  const [checkingPreview, setCheckingPreview] = useState(false)
  const [previewMissing, setPreviewMissing] = useState(false)
  function openModal() {
    setOpen(true)
    if (kind === 'other') return
    setCheckingPreview(true)
    setPreviewMissing(false)
    fetch(src, { method: 'HEAD' })
      .then((res) => setPreviewMissing(!res.ok))
      .catch(() => setPreviewMissing(true))
      .finally(() => setCheckingPreview(false))
  }

  // Bug real reportado en vivo: `<a href={src} download>` con src=/api/files
  // parecía "no hacer nada" — /api/files responde 307 a una URL firmada de
  // R2 (otro origen); el atributo download del navegador se ignora al
  // cruzar de origen sin que la respuesta final traiga
  // Content-Disposition:attachment, así que el clic navegaba la pestaña
  // entera fuera de la app hacia la URL cruda de R2 en vez de descargar.
  // Mismo fix ya probado en DownloadPdfButton/DocumentQuickPreview: bajar
  // los bytes por fetch (mismo origen hasta ahí) y disparar la descarga
  // desde un blob: URL, que sí respeta `download` siempre.
  async function download() {
    setDownloading(true)
    setDownloadError(false)
    try {
      // Para keys de R2, src=/api/files?... normalmente 307-redirige a la URL
      // firmada de R2 (otro origen) — fetch() no puede seguir ese salto por
      // CORS. &download=1 hace que la ruta devuelva los bytes directo, mismo
      // origen de punta a punta (ver api/files/route.ts). Para fuentes no-R2
      // (data:/http: ya resueltas por resolveFileSrc) src ya es descargable tal cual.
      const downloadSrc = src.startsWith('/api/files')
        ? `${src}&download=1&filename=${encodeURIComponent(displayName)}`
        : src
      const res = await fetch(downloadSrc)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = displayName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setDownloadError(true)
      setTimeout(() => setDownloadError(false), 4000)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <button type="button" onClick={openModal} className={className ?? 'text-xs font-semibold text-brand hover:underline'}>
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

        {checkingPreview && (kind === 'pdf' || kind === 'image') && (
          <div className="flex h-[70vh] items-center justify-center text-sm text-gray-400">Cargando vista previa…</div>
        )}
        {!checkingPreview && previewMissing && (kind === 'pdf' || kind === 'image') && (
          <EmptyState
            title="Documento no disponible"
            description="El archivo no se encontró en el almacenamiento — puede haberse movido o eliminado. Puedes intentar descargarlo o contactar a soporte si esto persiste."
          />
        )}
        {!checkingPreview && !previewMissing && kind === 'pdf' && (
          <iframe src={src} title={displayName} className="h-[70vh] w-full rounded-md border border-gray-200" />
        )}
        {!checkingPreview && !previewMissing && kind === 'image' && (
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
          <button type="button" onClick={download} disabled={downloading} className={buttonClass('primary', 'sm')}>
            {downloading ? 'Descargando…' : downloadError ? 'Error, reintentar' : 'Descargar'}
          </button>
        </div>
      </Modal>
    </>
  )
}
