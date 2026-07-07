import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pdf } from 'pdf-to-img'
import { generateQuotePdf } from '../../src/lib/quotes/pdf.ts'
import { sampleQuote } from '../../src/lib/quotes/sample.ts'
import type { QuoteData } from '../../src/lib/quotes/types'

const TIMEOUT = 60_000
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwAChwGA60e6kgAAAABJRU5ErkJggg=='

async function pageCount(buf: Buffer): Promise<number> {
  const doc = await pdf(buf)
  return doc.length
}

function isPdf(buf: Buffer): boolean {
  return buf.subarray(0, 5).toString('latin1') === '%PDF-'
}

test('PDF base clásico: válido y ≤ 2 páginas (sin portada vacía)', { timeout: TIMEOUT }, async () => {
  const buf = await generateQuotePdf({ ...sampleQuote, template: 'clasico' })
  assert.ok(isPdf(buf), 'debe ser un PDF')
  assert.ok((await pageCount(buf)) <= 2, 'la portada ya no debe ocupar una página completa')
})

test('PDF borde: datos vacíos no rompen la generación', { timeout: TIMEOUT }, async () => {
  const empty: QuoteData = {
    ...sampleQuote,
    scope: [],
    items: [],
    exclusions: [],
    commercialConditions: [],
    images: [],
    executiveSummary: '',
    adjustments: [],
  }
  const buf = await generateQuotePdf(empty)
  assert.ok(isPdf(buf))
  assert.ok((await pageCount(buf)) >= 1)
})

test('PDF estrés: muchos ítems + imágenes + ajustes pagina en múltiples páginas', { timeout: TIMEOUT }, async () => {
  const stress: QuoteData = {
    ...sampleQuote,
    coverImageUrl: IMG,
    customColumns: [{ id: 'c1', label: 'Frecuencia' }],
    items: Array.from({ length: 26 }, (_, i) => ({
      description: `Servicio ${i + 1} de mantención preventiva de equipo crítico`,
      detail: i % 3 === 0 ? 'Incluye repuestos y certificado' : undefined,
      quantity: (i % 5) + 1,
      unitPrice: 120000 + i * 1000,
      custom: { c1: 'Anual' },
    })),
    adjustments: [
      { key: 'utilidad', label: 'Utilidad', percent: 7, enabled: true },
      { key: 'gastos_admin', label: 'Gastos administrativos', percent: 3, enabled: true },
      { key: 'ajuste_comercial', label: 'Ajuste comercial', percent: 5, enabled: true },
    ],
    images: Array.from({ length: 4 }, (_, i) => ({ url: IMG, caption: `Foto ${i + 1}` })),
  }
  const buf = await generateQuotePdf(stress)
  assert.ok(isPdf(buf))
  assert.ok((await pageCount(buf)) >= 3, 'un documento largo debe paginar')
})

test('PDF borde: monedas y caracteres especiales no rompen', { timeout: TIMEOUT }, async () => {
  const data: QuoteData = {
    ...sampleQuote,
    currency: 'UF',
    client: { ...sampleQuote.client, name: 'Cliente & Cía <Ltda> "Especial"' },
    executiveSummary: 'Texto con <tags>, & ampersands y "comillas" — y un guion largo.',
  }
  const buf = await generateQuotePdf(data)
  assert.ok(isPdf(buf))
})
