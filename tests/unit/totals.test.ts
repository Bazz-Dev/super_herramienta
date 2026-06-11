import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTotals } from '../../src/lib/quotes/types'
import { sampleQuote } from '../../src/lib/quotes/sample'

test('computeTotals: base = suma de qty*precio', () => {
  const t = computeTotals(sampleQuote)
  // 4*320000 + 18*145000 + 1*680000 = 1.280.000 + 2.610.000 + 680.000
  assert.equal(t.base, 4_570_000)
  assert.equal(t.adjustments.length, 0) // todos deshabilitados en el sample
  assert.equal(t.net, 4_570_000)
  assert.equal(t.tax, Math.round(4_570_000 * 0.19))
  assert.equal(t.total, t.net + t.tax)
})

test('computeTotals: ajustes habilitados se aplican sobre la base, antes del neto', () => {
  const data = {
    ...sampleQuote,
    adjustments: [
      { key: 'utilidad', label: 'Utilidad', percent: 7, enabled: true },
      { key: 'gastos_admin', label: 'Gastos administrativos', percent: 3, enabled: true },
      { key: 'ajuste_comercial', label: 'Ajuste comercial', percent: 0, enabled: false },
    ],
  }
  const t = computeTotals(data)
  assert.equal(t.base, 4_570_000)
  assert.equal(t.adjustments.length, 2)
  const utilidad = Math.round(4_570_000 * 0.07)
  const gastos = Math.round(4_570_000 * 0.03)
  assert.equal(t.adjustments[0].amount, utilidad)
  assert.equal(t.adjustments[1].amount, gastos)
  assert.equal(t.net, 4_570_000 + utilidad + gastos)
  assert.equal(t.tax, Math.round(t.net * 0.19))
})

test('computeTotals: borde — sin ítems da todo en cero', () => {
  const t = computeTotals({ ...sampleQuote, items: [] })
  assert.deepEqual(t, { base: 0, adjustments: [], net: 0, tax: 0, total: 0 })
})

test('computeTotals: borde — cantidad o precio en cero', () => {
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

test('computeTotals: borde — taxRate 0 no agrega IVA', () => {
  const t = computeTotals({ ...sampleQuote, taxRate: 0, adjustments: [] })
  assert.equal(t.tax, 0)
  assert.equal(t.total, t.net)
})
