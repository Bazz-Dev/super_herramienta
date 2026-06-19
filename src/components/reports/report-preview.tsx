'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Renders the report using the exact HTML/CSS the PDF uses, inside an isolated
// iframe at A4 width (≈794px @96dpi) scaled to fit the panel. Mirrors the
// proposal preview so what you see matches the generated PDF layout.
export function ReportPreview({
  html,
  virtualWidth = 794,
  zoom = 1,
}: {
  html: string
  virtualWidth?: number
  zoom?: number
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(900)

  const measure = useCallback(() => {
    const wrap = wrapRef.current
    const frame = frameRef.current
    if (!wrap || !frame) return
    const avail = wrap.clientWidth
    setScale(Math.min(1, avail / virtualWidth) * zoom)
    const root = frame.contentWindow?.document?.documentElement
    if (root) setHeight(root.scrollHeight)
  }, [virtualWidth, zoom])

  useEffect(() => {
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [measure])

  useEffect(() => {
    measure()
  }, [html, measure])

  return (
    <div ref={wrapRef} className="w-full">
      <div style={{ height: height * scale }} className="shadow-sm">
        <iframe
          ref={frameRef}
          title="Vista previa del informe técnico"
          srcDoc={html}
          onLoad={measure}
          style={{
            width: virtualWidth,
            height,
            border: 0,
            background: '#ffffff',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  )
}
