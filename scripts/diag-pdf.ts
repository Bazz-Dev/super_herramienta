// Diagnostic: generate quote PDFs (base + stress) and rasterize each page to PNG
// so we can visually inspect pagination/order issues.
//   npx tsx scripts/diag-pdf.ts
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { pdf } from 'pdf-to-img'
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

async function rasterize(label: string, data: QuoteData) {
  const buf = await generateQuotePdf(data)
  const doc = await pdf(buf, { scale: 2 })
  let n = 0
  for await (const page of doc) {
    n++
    writeFileSync(`${OUT}/${label}-p${n}.png`, page)
  }
  console.log(`${label}: ${doc.length} páginas → ${OUT}/${label}-p*.png`)
}

await rasterize('clasico-base', { ...sampleQuote, template: 'clasico' })
await rasterize('minimal-base', { ...sampleQuote, template: 'minimal' })
await rasterize('clasico-stress', { ...stress, template: 'clasico' })
await rasterize('minimal-stress', { ...stress, template: 'minimal' })
console.log('Listo.')
