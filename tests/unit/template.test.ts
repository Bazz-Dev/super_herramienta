import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderQuoteHTML } from '../../src/lib/quotes/template'
import { sampleQuote } from '../../src/lib/quotes/sample'
import type { QuoteData } from '../../src/lib/quotes/types'

test('renderQuoteHTML: incluye las secciones principales', () => {
  const html = renderQuoteHTML(sampleQuote)
  for (const s of ['Resumen ejecutivo', 'Alcance de trabajo', 'Detalle de precios', 'Exclusiones', 'Condiciones comerciales']) {
    assert.ok(html.includes(s), `falta la sección "${s}"`)
  }
  assert.ok(html.includes(sampleQuote.quoteId))
  assert.ok(html.includes(sampleQuote.client.name))
})

test('renderQuoteHTML: NO fuerza salto de página tras la portada', () => {
  const html = renderQuoteHTML(sampleQuote)
  assert.ok(!/\.cover\s*\{[^}]*break-after:\s*page/.test(html), 'la portada no debe forzar salto de página')
})

test('renderQuoteHTML: escapa HTML (anti-XSS) en campos de usuario', () => {
  const evil = '<script>alert(1)</script>'
  const data: QuoteData = { ...sampleQuote, client: { ...sampleQuote.client, name: evil } }
  const html = renderQuoteHTML(data)
  assert.ok(!html.includes('<script>alert(1)</script>'), 'no debe inyectar <script> sin escapar')
  assert.ok(html.includes('&lt;script&gt;'), 'debe escapar a entidades HTML')
})

test('renderQuoteHTML: borde — arrays vacíos no rompen el render', () => {
  const data: QuoteData = {
    ...sampleQuote,
    scope: [],
    items: [],
    exclusions: [],
    commercialConditions: [],
    images: [],
    executiveSummary: '',
  }
  const html = renderQuoteHTML(data)
  assert.ok(html.startsWith('<!DOCTYPE html>'))
  assert.ok(html.includes('Sin exclusiones.'))
})

test('renderQuoteHTML: columnas dinámicas aparecen como encabezados', () => {
  const data: QuoteData = {
    ...sampleQuote,
    customColumns: [{ id: 'c1', label: 'Frecuencia' }],
    items: [{ description: 'x', quantity: 1, unitPrice: 1000, custom: { c1: 'Anual' } }],
  }
  const html = renderQuoteHTML(data)
  assert.ok(html.includes('Frecuencia'))
  assert.ok(html.includes('Anual'))
})

test('renderQuoteHTML: muestra líneas de ajuste cuando están habilitadas', () => {
  const data: QuoteData = {
    ...sampleQuote,
    adjustments: [{ key: 'utilidad', label: 'Utilidad', percent: 7, enabled: true }],
  }
  const html = renderQuoteHTML(data)
  assert.ok(html.includes('Costo base'))
  assert.ok(html.includes('Utilidad (7%)'))
})
