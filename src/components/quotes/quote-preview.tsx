'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Renders the quote using the exact same HTML/CSS the PDF uses, inside an
// isolated iframe at A4 width (≈794px @96dpi) scaled down to fit the panel.
// What you see matches the PDF layout (true page breaks only show in the PDF).
export function QuotePreview({ html, virtualWidth = 794 }: { html: string; virtualWidth?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(900)

  const measure = useCallback(() => {
    const wrap = wrapRef.current
    const frame = frameRef.current
    if (!wrap || !frame) return
    const avail = wrap.clientWidth
    setScale(Math.min(1, avail / virtualWidth))
    const doc = frame.contentWindow?.document
    if (doc) setHeight(doc.documentElement.scrollHeight)
  }, [virtualWidth])

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
          title="Vista previa de cotización"
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
