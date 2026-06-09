'use client'

import { useCallback, useRef } from 'react'

// Renders the quote using the exact same HTML/CSS that the PDF uses, inside an
// isolated iframe — so what you see is what the PDF will be. The `html` is built
// server-side by renderQuoteHTML() and passed down.
export function QuotePreview({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)

  const fitHeight = useCallback(() => {
    const frame = ref.current
    const doc = frame?.contentWindow?.document
    if (frame && doc) {
      frame.style.height = `${doc.documentElement.scrollHeight}px`
    }
  }, [])

  return (
    <div className="inline-block overflow-hidden rounded-lg border border-gray-300 shadow-sm">
      <iframe
        ref={ref}
        title="Vista previa de cotización"
        srcDoc={html}
        width={390}
        onLoad={fitHeight}
        className="block bg-white"
        style={{ width: 390, border: 0 }}
      />
    </div>
  )
}
