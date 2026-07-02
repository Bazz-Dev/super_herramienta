'use client'

import { useState } from 'react'

interface Props {
  docId: string
  title: string
  primary: string
  date: string
}

export function PortalInformeBtn({ docId, title, primary, date }: Props) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleDownload() {
    setLoading(true); setErr('')
    try {
      const metaRes = await fetch(`/api/portal/informes?id=${docId}`)
      if (!metaRes.ok) throw new Error('No se pudo cargar el informe')
      const { dataJson } = await metaRes.json()
      if (!dataJson) throw new Error('Informe sin contenido')

      const pdfRes = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: JSON.parse(dataJson) }),
      })
      if (!pdfRes.ok) throw new Error('Error generando PDF')

      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al descargar')
    } finally {
      setLoading(false) }
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

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#f3f4f6' : primary, color: loading ? '#9ca3af' : '#fff',
          fontSize: '12px', fontWeight: '700', fontFamily: 'inherit', flexShrink: 0, transition: 'opacity 0.15s',
        }}
      >
        {loading ? (
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
  )
}
