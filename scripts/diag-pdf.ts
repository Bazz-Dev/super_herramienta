// Diagnostic: generate quote PDFs (base + stress) and rasterize each page to PNG
// so we can visually inspect pagination/order issues.
//   npx tsx scripts/diag-pdf.ts
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { launchBrowser } from '../src/lib/pdf/render'
import { generateQuotePdf } from '../src/lib/quotes/pdf'
import { sampleQuote } from '../src/lib/quotes/sample'
import type { QuoteData } from '../src/lib/quotes/types'

const OUT = 'tmp-pdf-diag'
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// 1x1 gray PNG as a stand-in image (cover banner + photo annex).
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const stress: QuoteData = {
  ...sampleQuote,
  coverImageUrl: IMG,
  customColumns: [
    { id: 'c1', label: 'Frecuencia' },
    { id: 'c2', label: 'Norma' },
  ],
  items: Array.from({ length: 26 }, (_, i) => ({
    description: `Servicio de mantención preventiva ítem ${i + 1} — equipo crítico de planta`,
    detail: i % 3 === 0 ? 'Incluye repuestos, mano de obra especializada y certificado de conformidad emitido por el laboratorio.' : undefined,
    quantity: (i % 5) + 1,
    unitPrice: 120000 + i * 15000,
    custom: { c1: i % 2 ? 'Semestral' : 'Anual', c2: 'ISO 14644-1' },
  })),
  adjustments: [
    { key: 'utilidad', label: 'Utilidad', percent: 7, enabled: true },
    { key: 'gastos_admin', label: 'Gastos administrativos', percent: 3, enabled: true },
    { key: 'ajuste_comercial', label: 'Ajuste comercial de cierre', percent: 5, enabled: true },
  ],
  images: Array.from({ length: 6 }, (_, i) => ({ url: IMG, caption: `Registro fotográfico ${i + 1}: estado del equipo antes de la intervención` })),
}

// Rasteriza el PDF completo (todas las páginas, scroll continuo del visor
// nativo de Chromium) como una sola imagen alta — mismo motor que
// src/lib/pdf-rasterize.ts, suficiente para inspección visual de paginación.
async function rasterize(label: string, data: QuoteData) {
  const buf = await generateQuotePdf(data)
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } })
    const dataUrl = `data:application/pdf;base64,${buf.toString('base64')}`
    await page.goto(dataUrl, { waitUntil: 'load', timeout: 15000 })
    await page.waitForTimeout(400)
    const screenshot = await page.screenshot({ type: 'png', fullPage: true })
    writeFileSync(`${OUT}/${label}.png`, screenshot)
    console.log(`${label} → ${OUT}/${label}.png`)
  } finally {
    await browser.close()
  }
}

await rasterize('clasico-base', { ...sampleQuote, template: 'clasico' })
await rasterize('clasico-stress', { ...stress, template: 'clasico' })
console.log('Listo.')
