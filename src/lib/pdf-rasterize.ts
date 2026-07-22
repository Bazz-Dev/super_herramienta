import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import { pdf } from 'pdf-to-img'

// pdfjs-dist (used by pdf-to-img) normally offloads parsing to a Web Worker,
// loaded via a dynamic import Turbopack can't resolve in this Next.js app
// ("Setting up fake worker failed: Cannot find module ...pdf.worker.mjs").
// Registering the worker's own message handler on globalThis makes pdfjs-dist
// run it on the main thread instead — pdf-to-img only ever processes one
// short-lived request at a time here, so there's no UI thread to block.
;(globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker

export async function rasterizePdfFirstPage(pdfBytes: Uint8Array): Promise<Buffer> {
  const doc = await pdf(pdfBytes, { scale: 2 })
  try {
    return await doc.getPage(1)
  } finally {
    await doc.destroy()
  }
}
