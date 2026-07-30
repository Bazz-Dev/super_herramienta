import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { launchBrowser } from '@/lib/pdf/render'

// Ruta plana (no require.resolve) a propósito: require.resolve/createRequire
// en el scope de módulo no sobrevive el bundling de Turbopack para código
// propio (a diferencia de un paquete externo en serverExternalPackages) —
// falló en build con "The 'path' argument must be of type string. Received
// type number", Turbopack reescribe esa resolución dinámica. Mismo patrón ya
// usado en src/lib/reports/pdf.ts para el caso legado de /uploads.
const pdfjsDir = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build')

// Rasteriza la página 1 de un PDF a PNG corriendo pdf.js DENTRO de una página
// real de Chromium (Canvas 2D nativo, sin polyfills) en vez de:
//   (a) pdf-to-img + @napi-rs/canvas — pdfjs-dist "legacy" (Node) necesita
//       @napi-rs/canvas para polyfillear `DOMMatrix`; ese paquete nativo no
//       cargaba en el runtime serverless de Vercel ("ReferenceError:
//       DOMMatrix is not defined", confirmado con logs reales de producción).
//   (b) navegar Chromium directo al PDF y capturar pantalla — Chromium
//       headless NO abre su visor PDF interno por defecto, dispara descarga
//       en su lugar ("page.goto: Download is starting", confirmado con el
//       test de este mismo archivo).
// pdf.js corriendo como script de página evita ambos: Canvas/DOMMatrix son
// APIs nativas del navegador ahí, y no depende del visor PDF de Chromium.
export async function rasterizePdfFirstPage(pdfBytes: Uint8Array): Promise<Buffer> {
  const [pdfjsSrc, workerSrc] = await Promise.all([
    readFile(path.join(pdfjsDir, 'pdf.min.mjs'), 'utf8'),
    readFile(path.join(pdfjsDir, 'pdf.worker.min.mjs'), 'utf8'),
  ])

  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.goto('about:blank')

    const pngDataUrl = await page.evaluate(
      async ({ pdfjsSrc, workerSrc, pdfBase64 }) => {
        const pdfjsBlobUrl = URL.createObjectURL(new Blob([pdfjsSrc], { type: 'text/javascript' }))
        const workerBlobUrl = URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }))
        const pdfjsLib = await import(/* webpackIgnore: true */ pdfjsBlobUrl)
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl

        const bin = atob(pdfBase64)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)

        const doc = await pdfjsLib.getDocument({ data: bytes }).promise
        const pdfPage = await doc.getPage(1)
        const viewport = pdfPage.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise
        return canvas.toDataURL('image/png')
      },
      { pdfjsSrc, workerSrc, pdfBase64: Buffer.from(pdfBytes).toString('base64') },
    )

    return Buffer.from(pngDataUrl.split(',')[1], 'base64')
  } finally {
    await browser.close()
  }
}
