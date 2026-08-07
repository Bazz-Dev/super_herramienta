'use client'

import { useEffect, useState } from 'react'

/**
 * Visor universal "Ver" para el portal (OT, Informes técnicos, Otros
 * documentos) — mismo patrón/lógica que FilePreviewButton
 * (src/components/ui/file-preview-modal.tsx) del lado interno: HEAD-check
 * antes de prometer un preview que puede fallar (mismo bug real ya
 * documentado — G67), descarga vía blob para no depender del atributo
 * `download` en una URL cruzada de origen (presigned R2), que el navegador
 * ignora sin Content-Disposition:attachment.
 *
 * No reusa FilePreviewButton tal cual: ese componente es 100% Tailwind
 * className, y frontend.md prohíbe eso en el portal sin excepciones (las
 * variables CSS de Tailwind no resuelven de forma confiable bajo dark mode
 * de OS/extensiones ahí — ya mordido una vez, ver feedback_portal_css).
 * Este componente reimplementa la misma lógica con inline styles y las
 * variables CSS ya en uso en todo /portal/[slug] (--tx, --t2, --t3, --bg,
 * --bd).
 */

function guessKind(nameOrUrl: string): 'pdf' | 'image' | 'other' {
  const clean = nameOrUrl.split('?')[0]
  const ext = clean.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image'
  return 'other'
}

export interface PortalPreviewMeta {
  label: string
  value: string
}

/**
 * Modal propiamente dicho, sin trigger propio -- controlado 100% por el
 * caller (open/onClose). Existe separado de PortalDocumentPreview para que
 * un caller que necesita generar el contenido primero (PortalInformeBtn: el
 * PDF de un informe se genera on-demand, no es una URL fija de entrada)
 * pueda mostrar su propio botón/estado de carga y solo montar el modal una
 * vez que ya tiene una URL real (network o blob: -- ambas soportan HEAD/GET
 * vía fetch, el chequeo de abajo funciona igual para las dos).
 */
export function PortalDocumentPreviewModal({
  open, onClose, url, name, accent, meta = [],
}: {
  open: boolean
  onClose: () => void
  url: string
  name: string
  accent: string
  meta?: PortalPreviewMeta[]
}) {
  const [checking, setChecking] = useState(false)
  const [missing, setMissing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)

  const kind = guessKind(name || url)

  useEffect(() => {
    if (!open) return
    if (kind === 'other') return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con un sistema externo (red: HEAD antes de prometer un preview), mismo patrón ya usado en portal-ticket-list.tsx
    setChecking(true)
    setMissing(false)
    fetch(url, { method: 'HEAD' })
      .then((res) => setMissing(!res.ok))
      .catch(() => setMissing(true))
      .finally(() => setChecking(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir/cambiar url, no en cada render
  }, [open, url])

  async function download() {
    setDownloading(true)
    setDownloadError(false)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch {
      setDownloadError(true)
      setTimeout(() => setDownloadError(false), 4000)
    } finally {
      setDownloading(false)
    }
  }

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--card, #fff)', borderRadius: '14px', width: '100%', maxWidth: '760px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--bd)', gap: '10px' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
          <button
            onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--t2)', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >✕</button>
        </div>

        {meta.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', padding: '10px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--bd)' }}>
            {meta.map((m) => (
              <div key={m.label} style={{ fontSize: '11px' }}>
                <span style={{ color: 'var(--t3)' }}>{m.label}: </span>
                <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{m.value}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', background: '#f3f4f6' }}>
          {checking && (kind === 'pdf' || kind === 'image') && (
            <p style={{ fontSize: '13px', color: 'var(--t3)' }}>Cargando vista previa…</p>
          )}
          {!checking && missing && (kind === 'pdf' || kind === 'image') && (
            <div style={{ textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', margin: '0 0 6px' }}>Documento no disponible</p>
              <p style={{ fontSize: '12px', color: 'var(--t3)', margin: 0, maxWidth: '320px' }}>El archivo no se encontró — puede haberse movido. Contacta a INGEGAR si esto persiste.</p>
            </div>
          )}
          {!checking && !missing && kind === 'pdf' && (
            <iframe src={url} title={name} style={{ width: '100%', height: '65vh', border: 'none' }} />
          )}
          {!checking && !missing && kind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada de R2, no un asset local optimizable
            <img src={url} alt={name} style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }} />
          )}
          {kind === 'other' && (
            <div style={{ textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)', margin: '0 0 6px' }}>Vista previa no disponible</p>
              <p style={{ fontSize: '12px', color: 'var(--t3)', margin: 0 }}>Este tipo de archivo no se puede previsualizar — descárgalo para verlo.</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: '1px solid var(--bd)' }}>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t2)', textDecoration: 'none', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--bd)' }}
          >
            Abrir original ↗
          </a>
          <button
            type="button" onClick={download} disabled={downloading}
            style={{ fontSize: '12px', fontWeight: 700, color: '#fff', background: downloading ? '#9ca3af' : accent, border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: downloading ? 'not-allowed' : 'pointer' }}
          >
            {downloading ? 'Descargando…' : downloadError ? 'Error, reintentar' : 'Descargar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Caso simple: la URL ya se conoce de entrada (OT, Otros documentos — ambos
 * son un fileUrl/R2 key ya presignado por el server component). Trae su
 * propio trigger + estado de apertura.
 */
export function PortalDocumentPreview({
  url, name, accent, label = 'Ver', meta = [],
}: {
  url: string
  name: string
  accent: string
  label?: React.ReactNode
  meta?: PortalPreviewMeta[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ fontSize: '12px', fontWeight: 600, color: accent, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
      >
        {label}
      </button>
      <PortalDocumentPreviewModal open={open} onClose={() => setOpen(false)} url={url} name={name} accent={accent} meta={meta} />
    </>
  )
}
