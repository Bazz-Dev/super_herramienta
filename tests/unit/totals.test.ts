import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTotals } from '../../src/lib/quotes/types'
import { sampleQuote } from '../../src/lib/quotes/sample'

// ── CLP (integer rounding) ──────────────────────────────────────────────────

test('CLP: base = suma de qty×precio', () => {
  const t = computeTotals(sampleQuote)
  // 4×320.000 + 18×145.000 + 1×680.000
  assert.equal(t.base, 4_570_000)
  assert.equal(t.adjustments.length, 0) // todos deshabilitados en sample
  assert.equal(t.net, 4_570_000)
  assert.equal(t.tax, Math.round(4_570_000 * 0.19))
  assert.equal(t.total, t.net + t.tax)
})

test('CLP: ajustes habilitados sobre la base, IVA sobre el neto completo', () => {
  const data = {
    ...sampleQuote,
    adjustments: [
      { key: 'utilidad', label: 'Utilidad', percent: 7, enabled: true },
      { key: 'gastos_admin', label: 'Gastos administrativos', percent: 3, enabled: true },
      { key: 'ajuste_comercial', label: 'Ajuste comercial', percent: 0, enabled: false },
    ],
  }
  const t = computeTotals(data)
  const utilidad = Math.round(4_570_000 * 0.07)
  const gastos   = Math.round(4_570_000 * 0.03)
  assert.equal(t.base, 4_570_000)
  assert.equal(t.adjustments.length, 2)
  assert.equal(t.adjustments[0].amount, utilidad)
  assert.equal(t.adjustments[1].amount, gastos)
  const net = 4_570_000 + utilidad + gastos
  assert.equal(t.net, net)
  assert.equal(t.tax, Math.round(net * 0.19))
  assert.equal(t.total, t.net + t.tax)
})

test('CLP: taxRate = 0 produce IVA = 0 y total = neto', () => {
  const t = computeTotals({ ...sampleQuote, taxRate: 0, adjustments: [] })
  assert.equal(t.tax, 0)
  assert.equal(t.total, t.net)
})

test('CLP: sin ítems todo en cero', () => {
  const t = computeTotals({ ...sampleQuote, items: [] })
  assert.deepEqual(t, { base: 0, adjustments: [], net: 0, tax: 0, total: 0 })
})

test('CLP: cantidad o precio en cero', () => {
  const t = computeTotals({
    ...sampleQuote,
    items: [
      { description: 'gratis', quantity: 0, unitPrice: 100, custom: {} },
      { description: 'muestra', quantity: 5, unitPrice: 0, custom: {} },
    ],
    adjustments: [],
  })
  assert.equal(t.base, 0)
  assert.equal(t.total, 0)
})

// ── UF (4 decimal rounding) ─────────────────────────────────────────────────

test('UF: IVA se redondea a 4 decimales, no a entero', () => {
  const data = {
    ...sampleQuote,
    currency: 'UF' as const,
    items: [{ description: 'Servicio', quantity: 1, unitPrice: 10.5, custom: {} }],
    adjustments: [],
    taxRate: 0.19,
  }
  const t = computeTotals(data)
  assert.equal(t.base, 10.5)
  assert.equal(t.net, 10.5)
  // 10.5 × 0.19 = 1.995 → rounded to 4 decimals = 1.9950
  assert.equal(t.tax, 1.9950)
  assert.equal(t.total, 10.5 + 1.9950)
})

test('UF: ajuste redondeado a 4 decimales', () => {
  const data = {
    ...sampleQuote,
    currency: 'UF' as const,
    items: [{ description: 'Servicio', quantity: 1, unitPrice: 100, custom: {} }],
    adjustments: [{ key: 'utilidad', label: 'Utilidad', percent: 7, enabled: true }],
    taxRate: 0.19,
  }
  const t = computeTotals(data)
  // 100 × 7% = 7.0000 → exact
  assert.equal(t.adjustments[0].amount, 7.0)
  const net = 107
  assert.equal(t.net, net)
  // 107 × 0.19 = 20.33
  assert.equal(t.tax, 20.33)
})

// ── USD (2 decimal rounding) ────────────────────────────────────────────────

test('USD: IVA redondeado a 2 decimales', () => {
  const data = {
    ...sampleQuote,
    currency: 'USD' as const,
    items: [{ description: 'Servicio', quantity: 1, unitPrice: 100.00, custom: {} }],
    adjustments: [],
    taxRate: 0.19,
  }
  const t = computeTotals(data)
  assert.equal(t.tax, 19.00)
  assert.equal(t.total, 119.00)
})
