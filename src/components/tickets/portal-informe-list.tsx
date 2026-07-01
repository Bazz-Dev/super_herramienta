'use client'

import { useState } from 'react'

interface InformeDoc {
  id: string
  title: string
  createdAt: string
  createdByName: string
  workOrder: string
  branch: string
  reportId: string
}

interface Props {
  docs: InformeDoc[]
  slug: string
  primary: string
  bg?: string
  cardBg?: string
  textColor?: string
}

const C = {
  bd: '#e0ddd8', t2: '#4b4540', t3: '#8c857e', t4: '#beb7b0',
  r: '10px', sh: '0 1px 3px rgba(0,0,0,0.07)',
}

function IconPdf() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
      <path d="M10 2v3h3"/>
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8M5 7l3 3 3-3"/><path d="M2 13h12"/>
    </svg>
  )
}

function DownloadBtn({ docId, title, primary }: { docId: string; title: string; primary: string }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleDownload() {
    setLoading(true)
    setErr('')
    try {
      // 1. Fetch document JSON (portal-safe endpoint, works with client role)
      const metaRes = await fetch(`/api/portal/informes?id=${docId}`)
      if (!metaRes.ok) throw new Error('No se pudo cargar el informe')
      const { dataJson } = await metaRes.json()
      if (!dataJson) throw new Error('Informe sin contenido')

      // 2. Generate PDF
      const pdfRes = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: JSON.parse(dataJson) }),
      })
      if (!pdfRes.ok) throw new Error('Error generando PDF')

      // 3. Download
      const blob = await pdfRes.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al descargar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8,
          background: loading ? '#f3f4f6' : primary,
          color: loading ? C.t3 : '#fff',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          transition: 'opacity 0.15s',
        }}
      >
        <IconDownload />
        {loading ? 'Generando…' : 'Descargar PDF'}
      </button>
      {err && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{err}</p>}
    </div>
  )
}

export function PortalInformeList({ docs, slug, primary, bg = '#f4f3f1', cardBg = '#ffffff', textColor = '#18130e' }: Props) {
  if (docs.length === 0) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: cardBg, border: `1px solid ${C.bd}`, borderRadius: 16, boxShadow: C.sh, padding: '52px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: textColor, marginBottom: 6 }}>Sin informes técnicos aún</div>
          <div style={{ fontSize: 13, color: C.t3 }}>
            Cuando INGEGAR genere informes técnicos para tu empresa, aparecerán aquí.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header strip */}
      <div style={{
        background: `linear-gradient(135deg, ${primary} 0%, color-mix(in srgb, ${primary} 60%, #000) 100%)`,
        borderRadius: 14, padding: '16px 20px', marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
            <path d="M10 2v3h3M5 8h6M5 11h4"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Informes Técnicos</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {docs.length} informe{docs.length !== 1 ? 's' : ''} · emitidos por INGEGAR
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {docs.map((doc, i) => (
          <div key={doc.id} style={{
            background: cardBg,
            border: `1px solid ${C.bd}`,
            borderRadius: 14,
            boxShadow: C.sh,
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            {/* Index */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `${primary}18`, display: 'grid', placeItems: 'center',
              fontSize: 13, fontWeight: 800, color: primary,
            }}>
              {docs.length - i}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: textColor, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: C.t3 }}>
                <span>
                  📅 {new Date(doc.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {doc.workOrder && <span>🔧 OT: {doc.workOrder}</span>}
                {doc.branch && <span>📍 {doc.branch}</span>}
                {doc.reportId && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>#{doc.reportId}</span>}
                <span>por {doc.createdByName}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ flexShrink: 0 }}>
              <DownloadBtn docId={doc.id} title={doc.title} primary={primary} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
