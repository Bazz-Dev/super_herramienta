'use client'

import { useState, useEffect, useCallback } from 'react'

export interface GalleryItem {
  id: string
  name: string
  url: string
  mimeType: string | null
}

interface Props {
  items: GalleryItem[]
  accent?: string
  onUpload?: (file: File) => Promise<GalleryItem>
  onDelete?: (id: string) => Promise<void>
  uploadLabel?: string
  emptyLabel?: string
}

const isImg = (m: string | null) => !!m?.startsWith('image/')
const SHOW  = 3

/* ── sub-components (outside render to avoid lint: react-hooks/static-components) ── */

interface TileProps {
  item: GalleryItem
  style: React.CSSProperties
  overlay?: React.ReactNode
  isDeleting: boolean
  onTileClick: () => void
  showDelete: boolean
  onDeleteClick: (e: React.MouseEvent) => void
}

function Tile({ item, style, overlay, isDeleting, onTileClick, showDelete, onDeleteClick }: TileProps) {
  const img = isImg(item.mimeType)
  return (
    <div
      style={{ ...style, position: 'relative', overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}
      className="gallery-tile"
      onClick={() => !isDeleting && onTileClick()}
    >
      {img ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={item.url} alt={item.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s ease' }}
          className="gallery-img"
        />
      ) : (
        <div style={{ width: '100%', height: '100%', background: '#0f0f0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M8 5.5l9 5.5-9 5.5V5.5z" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', textAlign: 'center', padding: '0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{item.name}</span>
        </div>
      )}

      {overlay}

      {showDelete && !overlay && (
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteClick(e) }}
          disabled={isDeleting}
          className="gallery-del"
          style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            color: '#fff', fontSize: '12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.15s, background 0.15s',
          }}
        >
          {isDeleting ? '…' : '✕'}
        </button>
      )}
    </div>
  )
}

function MoreOverlay({ n }: { n: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <span style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>+{n}</span>
    </div>
  )
}

/* ── Main component ── */

export function PhotoGallery({
  items,
  accent = '#f5b100',
  onUpload,
  onDelete,
  uploadLabel = 'Agregar foto o video',
  emptyLabel  = 'Sin fotos ni videos aún.',
}: Props) {
  const [lb,   setLb]   = useState<number | null>(null)
  const [dels, setDels] = useState<Set<string>>(new Set())
  const [upl,  setUpl]  = useState(false)
  const [uplErr, setUplErr] = useState('')

  const imgItems = items.filter(i => isImg(i.mimeType))

  const openLb = useCallback((item: GalleryItem) => {
    const idx = imgItems.findIndex(i => i.id === item.id)
    if (idx >= 0) setLb(idx)
    else window.open(item.url, '_blank', 'noopener')
  }, [imgItems])

  const goNext = useCallback(() => setLb(i => i !== null ? (i + 1) % imgItems.length : null), [imgItems.length])
  const goPrev = useCallback(() => setLb(i => i !== null ? (i - 1 + imgItems.length) % imgItems.length : null), [imgItems.length])

  useEffect(() => {
    if (lb === null) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') setLb(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [lb, goNext, goPrev])

  useEffect(() => {
    if (lb !== null) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [lb])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !onUpload) return
    setUpl(true); setUplErr('')
    try {
      await onUpload(file)
    } catch (err) {
      setUplErr(err instanceof Error ? err.message : 'Error al subir')
    } finally { setUpl(false); e.target.value = '' }
  }

  function handleDeleteClick(id: string) {
    if (!onDelete) return
    setDels(d => new Set(d).add(id))
    onDelete(id)
      .catch(() => {/* noop */})
      .finally(() => setDels(d => { const n = new Set(d); n.delete(id); return n }))
  }

  const visible = items.slice(0, SHOW)
  const extra   = Math.max(0, items.length - SHOW)
  const R = '12px'
  const G = '3px'
  const H = '260px'
  const n = visible.length

  return (
    <>
      <style>{`
        .gallery-tile:hover .gallery-img { transform: scale(1.04); }
        .gallery-tile:hover .gallery-del { opacity: 1 !important; }
        .gallery-del:hover { background: rgba(220,38,38,0.85) !important; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {n === 0 && !onUpload && (
          <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>{emptyLabel}</p>
        )}

        {n === 1 && (
          <div style={{ borderRadius: R, overflow: 'hidden', height: '220px' }}>
            <Tile
              item={visible[0]} style={{ width: '100%', height: '100%' }}
              isDeleting={dels.has(visible[0].id)}
              onTileClick={() => openLb(visible[0])}
              showDelete={!!onDelete}
              onDeleteClick={() => handleDeleteClick(visible[0].id)}
            />
          </div>
        )}

        {n === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: G, borderRadius: R, overflow: 'hidden', height: H }}>
            <Tile item={visible[0]} style={{ height: '100%' }} isDeleting={dels.has(visible[0].id)} onTileClick={() => openLb(visible[0])} showDelete={!!onDelete} onDeleteClick={() => handleDeleteClick(visible[0].id)} />
            <Tile item={visible[1]} style={{ height: '100%' }} isDeleting={dels.has(visible[1].id)} onTileClick={() => openLb(visible[1])} showDelete={!!onDelete} onDeleteClick={() => handleDeleteClick(visible[1].id)} />
          </div>
        )}

        {n >= 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: `calc(${H} / 2) calc(${H} / 2)`, gap: G, borderRadius: R, overflow: 'hidden' }}>
            <Tile item={visible[0]} style={{ gridRow: '1 / 3', height: '100%' }} isDeleting={dels.has(visible[0].id)} onTileClick={() => openLb(visible[0])} showDelete={!!onDelete} onDeleteClick={() => handleDeleteClick(visible[0].id)} />
            <Tile item={visible[1]} style={{ height: '100%' }} isDeleting={dels.has(visible[1].id)} onTileClick={() => openLb(visible[1])} showDelete={!!onDelete} onDeleteClick={() => handleDeleteClick(visible[1].id)} />
            <Tile
              item={visible[2]} style={{ height: '100%' }}
              isDeleting={dels.has(visible[2].id)}
              onTileClick={() => openLb(visible[2])}
              showDelete={!!onDelete}
              onDeleteClick={() => handleDeleteClick(visible[2].id)}
              overlay={extra > 0 ? <MoreOverlay n={extra} /> : undefined}
            />
          </div>
        )}

        {onUpload && (
          <label
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', borderRadius: R, border: '2px dashed #d1d5db', cursor: upl ? 'not-allowed' : 'pointer', color: '#6b7280', fontSize: '13px', fontWeight: '500', transition: 'all 0.15s', opacity: upl ? 0.5 : 1 }}
            onMouseOver={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent }}
            onMouseOut={e  => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280' }}
          >
            {upl ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="7" cy="7" r="5" strokeDasharray="24" strokeDashoffset="8">
                    <animateTransform attributeName="transform" type="rotate" from="0 7 7" to="360 7 7" dur="0.8s" repeatCount="indefinite"/>
                  </circle>
                </svg>
                Subiendo…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4.5 5.5 8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.5 12.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                {uploadLabel}
              </>
            )}
            <input type="file" style={{ display: 'none' }} accept="image/*,video/*" disabled={upl} onChange={handleUpload} />
          </label>
        )}

        {uplErr && <p style={{ fontSize: '12px', color: '#ef4444', textAlign: 'center' }}>{uplErr}</p>}
      </div>

      {/* ── Lightbox ── */}
      {lb !== null && imgItems.length > 0 && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.93)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setLb(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: 'min(90vw, 900px)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ position: 'absolute', top: '-48px', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}>
                {lb + 1} / {imgItems.length}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <a
                  href={imgItems[lb].url} download={imgItems[lb].name} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: '12px', color: accent, textDecoration: 'none', fontWeight: '600', padding: '4px 10px', borderRadius: '6px', background: `color-mix(in srgb, ${accent} 15%, transparent)` }}
                >
                  ↓ Descargar
                </a>
                <button
                  onClick={() => setLb(null)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                >✕</button>
              </div>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={imgItems[lb].id}
              src={imgItems[lb].url} alt={imgItems[lb].name}
              style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: '10px', display: 'block', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
            />

            <p style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80vw' }}>
              {imgItems[lb].name}
            </p>

            {imgItems.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  style={{ position: 'absolute', left: '-52px', top: '40%', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseOut={e  => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >‹</button>
                <button
                  onClick={goNext}
                  style={{ position: 'absolute', right: '-52px', top: '40%', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseOut={e  => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >›</button>
              </>
            )}

            {imgItems.length > 2 && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px', overflow: 'auto', maxWidth: '100%', paddingBottom: '4px' }}>
                {imgItems.map((img, idx) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id} src={img.url} alt={img.name}
                    onClick={() => setLb(idx)}
                    style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', flexShrink: 0, border: idx === lb ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.12)', opacity: idx === lb ? 1 : 0.55, transition: 'all 0.15s' }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
