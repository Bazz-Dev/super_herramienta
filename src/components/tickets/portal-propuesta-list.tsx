'use client'

import { useState } from 'react'
import { resolveQuoteUrl } from '@/lib/quotes/resolve-quote-url'
import { PortalDocumentPreviewModal } from './portal-document-preview'

interface PropuestaDoc {
  id: string
  title: string
  createdAt: string
  createdByName: string
  quoteId: string
  totalLabel: string
}

interface Props {
  docs: PropuestaDoc[]
  slug: string
  primary: string
  bg?: string
  cardBg?: string
  textColor?: string
}

const C = {
  bd: '#e0ddd8', t2: '#4b4540', t3: '#8c857e',
  r: '10px', sh: '0 1px 3px rgba(0,0,0,0.07)',
}

function IconDownload() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8M5 7l3 3 3-3"/><path d="M2 13h12"/>
    </svg>
  )
}

// Ver + Descargar — antes esta lista SOLO tenía "Descargar PDF" (bug real
// reportado: propuestas comerciales sin forma de verlas sin descargar, a
// diferencia de Informes técnicos, que ya tienen ambas acciones vía
// portal-informe-btn.tsx). Mismo patrón: resolveQuoteUrl() resuelve una vez,
// Ver abre PortalDocumentPreviewModal (in-app, nunca navega afuera),
// Descargar agrega &download=1 para el caso de archivo real.
function DocActions({ docId, title, primary }: { docId: string; title: string; primary: string }) {
  const [loading, setLoading] = useState<'ver' | 'descargar' | null>(null)
  const [err, setErr] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

  async function handleVer() {
    setLoading('ver'); setErr('')
    try {
      setPreviewUrl(await resolveQuoteUrl(docId))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(null)
    }
  }

  async function handleDownload() {
    setLoading('descargar'); setErr('')
    try {
      const url = await resolveQuoteUrl(docId, { download: true, filename })
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleVer}
          disabled={loading !== null}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 8, cursor: loading !== null ? 'not-allowed' : 'pointer',
            background: 'none', border: `1px solid color-mix(in srgb, ${primary} 30%, transparent)`, color: primary,
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
          }}
        >
          {loading === 'ver' ? 'Cargando…' : 'Ver'}
        </button>
        <button
          onClick={handleDownload}
          disabled={loading !== null}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: loading !== null ? '#f3f4f6' : primary,
            color: loading !== null ? C.t3 : '#fff',
            border: 'none', cursor: loading !== null ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
        >
          <IconDownload />
          {loading === 'descargar' ? 'Generando…' : 'Descargar PDF'}
        </button>
      </div>
      {err && <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>{err}</p>}
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

export function PortalPropuestaList({ docs, slug: _slug, primary, bg: _bg = '#f4f3f1', cardBg = '#ffffff', textColor = '#18130e' }: Props) {
  if (docs.length === 0) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <div style={{ background: cardBg, border: `1px solid ${C.bd}`, borderRadius: 16, boxShadow: C.sh, padding: '52px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: textColor, marginBottom: 6 }}>Sin propuestas aún</div>
          <div style={{ fontSize: 13, color: C.t3 }}>
            Cuando INGEGAR genere propuestas comerciales para tu empresa, aparecerán aquí.
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
            <rect x="1" y="4" width="14" height="11" rx="1.5"/>
            <path d="M5 4V3a2 2 0 014 0v1"/>
            <path d="M5 9h6M5 12h3"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Propuestas Comerciales</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            {docs.length} propuesta{docs.length !== 1 ? 's' : ''} · emitidas por INGEGAR
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {docs.map((doc, i) => (
          <div key={doc.id} style={{
            background: cardBg, border: `1px solid ${C.bd}`,
            borderRadius: 14, boxShadow: C.sh, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
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
                {doc.quoteId && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>#{doc.quoteId}</span>}
                {doc.totalLabel && <span style={{ fontWeight: 700, color: textColor }}>Total: {doc.totalLabel}</span>}
                <span>por {doc.createdByName}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ flexShrink: 0 }}>
              <DocActions docId={doc.id} title={doc.title} primary={primary} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
