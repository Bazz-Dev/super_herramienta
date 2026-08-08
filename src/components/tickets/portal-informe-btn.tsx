'use client'

import { useState } from 'react'
import { PortalDocumentPreviewModal } from './portal-document-preview'
import { resolveInformeUrl } from '@/lib/reports/resolve-informe-url'

interface Props {
  docId: string
  title: string
  primary: string
  date: string
}

// Ver/Descargar comparten la misma resolución (resolveInformeUrl) y solo
// difieren en qué hacen con la URL resultante.
export function PortalInformeBtn({ docId, title, primary, date }: Props) {
  const [loading, setLoading] = useState<'ver' | 'descargar' | null>(null)
  const [err, setErr] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

  async function handleVer() {
    setLoading('ver'); setErr('')
    try {
      setPreviewUrl(await resolveInformeUrl(docId))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(null)
    }
  }

  async function handleDownload() {
    setLoading('descargar'); setErr('')
    try {
      const url = await resolveInformeUrl(docId, { download: true, filename })
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al descargar')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: `color-mix(in srgb, ${primary} 6%, white)`, borderRadius: '12px', border: `1px solid color-mix(in srgb, ${primary} 20%, transparent)` }}>
      {/* Icon */}
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `color-mix(in srgb, ${primary} 15%, white)`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
          <path d="M10 2v3h3M5 7h6M5 10h4"/>
        </svg>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{title}</p>
        <p style={{ fontSize: '11px', color: 'var(--p-t3)', marginTop: '2px' }}>{date}</p>
        {err && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>{err}</p>}
      </div>

      {/* Ver + Descargar */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={handleVer}
          disabled={loading !== null}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '7px 12px', borderRadius: '8px', cursor: loading !== null ? 'not-allowed' : 'pointer',
            background: 'none', border: `1px solid color-mix(in srgb, ${primary} 30%, transparent)`, color: primary,
            fontSize: '12px', fontWeight: '700', fontFamily: 'inherit',
          }}
        >
          {loading === 'ver' ? 'Cargando…' : 'Ver'}
        </button>
        <button
          onClick={handleDownload}
          disabled={loading !== null}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: loading !== null ? 'not-allowed' : 'pointer',
            background: loading !== null ? '#f3f4f6' : primary, color: loading !== null ? '#9ca3af' : '#fff',
            fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', transition: 'opacity 0.15s',
          }}
        >
          {loading === 'descargar' ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="6" r="4" strokeDasharray="20" strokeDashoffset="6"><animateTransform attributeName="transform" type="rotate" from="0 6 6" to="360 6 6" dur="0.8s" repeatCount="indefinite"/></circle></svg>
              Generando…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1v7M3 6l3 3 3-3"/><path d="M1 10h10"/></svg>
              Descargar
            </>
          )}
        </button>
      </div>

      {previewUrl && (
        <PortalDocumentPreviewModal
          open={!!previewUrl}
          onClose={() => { if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
          url={previewUrl}
          name={filename}
          accent={primary}
        />
      )}
    </div>
  )
}
