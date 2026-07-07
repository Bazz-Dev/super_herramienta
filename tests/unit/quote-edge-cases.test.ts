/**
 * Unit tests for computeTotals() in src/lib/quotes/types.ts
 * Runner: node --import tsx --test
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeTotals, defaultAdjustments, type QuoteData } from '../../src/lib/quotes/types.ts'

// Minimal valid QuoteData factory — only overrides what each test needs.
function makeQuote(overrides: Partial<QuoteData> = {}): QuoteData {
  return {
    template: 'clasico',
    quoteId: 'ING-SRV-260101-ACME-001',
    date: '2026-01-01',
    validityDays: 30,
    client: { name: 'ACME' },
    tagline: 'Ingeniería y Gestión de Activos',
    executiveSummary: '',
    scope: [],
    customColumns: [],
    images: [],
    items: [],
    adjustments: defaultAdjustments(),
    currency: 'CLP',
    taxRate: 0.19,
    exclusions: [],
    commercialConditions: [],
    contact: { company: 'INGEGAR SpA', email: 'contacto@ingegarchile.cl', web: 'ingegarchile.cl' },
    ...overrides,
  }
}

// ─── 1. IVA calculation ───────────────────────────────────────────────────────
describe('IVA calculation', () => {
  it('tax = Math.round(net * 0.19) and total = net + tax', () => {
    const q = makeQuote({
      items: [{ description: 'Servicio', quantity: 2, unitPrice: 1000, custom: {} }],
    })
    const t = computeTotals(q)
    assert.equal(t.base, 2000)
    assert.equal(t.net, 2000)
    assert.equal(t.tax, Math.round(2000 * 0.19))   // 380
    assert.equal(t.total, t.net + t.tax)            // 2380
  })

  it('tax rounds to nearest peso (integer) for CLP', () => {
    // 3 * 333 = 999 → tax = round(999 * 0.19) = round(189.81) = 190
    const q = makeQuote({
      items: [{ description: 'Item', quantity: 3, unitPrice: 333, custom: {} }],
    })
    const t = computeTotals(q)
    assert.equal(t.tax, 190)
    assert.equal(typeof t.tax, 'number')
    assert.ok(Number.isInteger(t.tax), 'CLP tax must be integer')
  })
})

// ─── 2. Empty items array ─────────────────────────────────────────────────────
describe('empty items', () => {
  it('all values are 0 when items = []', () => {
    const t = computeTotals(makeQuote({ items: [] }))
    assert.equal(t.base, 0)
    assert.equal(t.net, 0)
    assert.equal(t.tax, 0)
    assert.equal(t.total, 0)
    assert.deepEqual(t.adjustments, [])
  })
})

// ─── 3. Currency = UF ────────────────────────────────────────────────────────
describe('currency UF', () => {
  it('rounds base/net to 4 decimal places', () => {
    // 1 * 1.12345678 → rounds to 4 dp = 1.1235
    const q = makeQuote({
      currency: 'UF',
      items: [{ description: 'UF item', quantity: 1, unitPrice: 1.12345678, custom: {} }],
    })
    const t = computeTotals(q)
    // base is the raw sum (not rounded)
    assert.equal(t.base, 1.12345678)
    // tax is rounded to 4 dp
    const expectedTax = Math.round(t.net * 0.19 * 10_000) / 10_000
    assert.equal(t.tax, expectedTax)
  })

  it('total = net + tax for UF', () => {
    const q = makeQuote({
      currency: 'UF',
      items: [{ description: 'UF', quantity: 2, unitPrice: 5.5, custom: {} }],
    })
    const t = computeTotals(q)
    assert.equal(t.total, t.net + t.tax)
  })
})

// ─── 4. Currency = USD ───────────────────────────────────────────────────────
describe('currency USD', () => {
  it('rounds tax to 2 decimal places', () => {
    // 1 * 100 = 100 → tax = round(100 * 0.19 * 100)/100 = 19.00
    const q = makeQuote({
      currency: 'USD',
      items: [{ description: 'USD item', quantity: 1, unitPrice: 100, custom: {} }],
    })
    const t = computeTotals(q)
    assert.equal(t.tax, 19)
    assert.equal(t.total, t.net + t.tax)
  })

  it('USD tax precision: fractional result rounds to cents', () => {
    // 1 * 10 = 10 → tax = round(10 * 0.19 * 100)/100 = 1.90
    const q = makeQuote({
      currency: 'USD',
      items: [{ description: 'USD', quantity: 1, unitPrice: 10, custom: {} }],
    })
    const t = computeTotals(q)
    assert.equal(t.tax, 1.9)
  })
})

// ─── 5. Zero quantity row ────────────────────────────────────────────────────
describe('zero quantity', () => {
  it('qty=0 contributes 0 to base', () => {
    const q = makeQuote({
      items: [
        { description: 'Zero', quantity: 0, unitPrice: 9999, custom: {} },
        { description: 'Real', quantity: 1, unitPrice: 500, custom: {} },
      ],
    })
    const t = computeTotals(q)
    assert.equal(t.base, 500)
  })
})

// ─── 6. Single enabled adjustment ───────────────────────────────────────────
describe('single adjustment', () => {
  it('utilidad 10% enabled → net = base + 10% of base', () => {
    const adjustments = defaultAdjustments().map((a) =>
      a.key === 'utilidad' ? { ...a, percent: 10, enabled: true } : a,
    )
    const q = makeQuote({
      items: [{ description: 'Work', quantity: 1, unitPrice: 1000, custom: {} }],
      adjustments,
    })
    const t = computeTotals(q)
    assert.equal(t.base, 1000)
    assert.equal(t.adjustments.length, 1)
    assert.equal(t.adjustments[0].amount, 100)    // 10% of 1000
    assert.equal(t.net, 1100)
    assert.equal(t.tax, Math.round(1100 * 0.19))  // 209
    assert.equal(t.total, t.net + t.tax)
  })

  it('adjustment line carries correct label and percent', () => {
    const adjustments = defaultAdjustments().map((a) =>
      a.key === 'utilidad' ? { ...a, percent: 7, enabled: true } : a,
    )
    const q = makeQuote({
      items: [{ description: 'W', quantity: 1, unitPrice: 2000, custom: {} }],
      adjustments,
    })
    const t = computeTotals(q)
    assert.equal(t.adjustments[0].label, 'Utilidad')
    assert.equal(t.adjustments[0].percent, 7)
  })
})

// ─── 7. Multiple adjustments — independent (each % of base) ─────────────────
describe('multiple adjustments', () => {
  it('utilidad 10% + gastos_admin 3%: each applied independently to base', () => {
    // From implementation: amount = round(base * a.percent / 100) for each
    // net = base + sum(amounts)
    const adjustments = defaultAdjustments().map((a) => {
      if (a.key === 'utilidad') return { ...a, percent: 10, enabled: true }
      if (a.key === 'gastos_admin') return { ...a, percent: 3, enabled: true }
      return a
    })
    const q = makeQuote({
      items: [{ description: 'Multi', quantity: 1, unitPrice: 1000, custom: {} }],
      adjustments,
    })
    const t = computeTotals(q)
    assert.equal(t.adjustments.length, 2)
    const utilidad = t.adjustments.find((a) => a.label === 'Utilidad')!
    const gastos = t.adjustments.find((a) => a.label === 'Gastos administrativos')!
    assert.equal(utilidad.amount, 100)   // 10% of 1000
    assert.equal(gastos.amount, 30)      // 3% of 1000
    assert.equal(t.net, 1130)            // 1000 + 100 + 30
  })

  it('disabled adjustments are excluded from the list', () => {
    // All adjustments disabled (default)
    const q = makeQuote({
      items: [{ description: 'Test', quantity: 1, unitPrice: 500, custom: {} }],
    })
    const t = computeTotals(q)
    assert.equal(t.adjustments.length, 0)
    assert.equal(t.net, t.base)
  })
})

// ─── 8. Negative adjustment (descuento) ─────────────────────────────────────
describe('negative adjustment (discount)', () => {
  it('negative percent reduces net below base', () => {
    const adjustments = defaultAdjustments().map((a) =>
      a.key === 'ajuste_comercial' ? { ...a, percent: -5, enabled: true } : a,
    )
    const q = makeQuote({
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000, custom: {} }],
      adjustments,
    })
    const t = computeTotals(q)
    const discountLine = t.adjustments[0]
    assert.equal(discountLine.amount, -50)  // -5% of 1000
    assert.equal(t.net, 950)
    assert.equal(t.tax, Math.round(950 * 0.19))
    assert.equal(t.total, t.net + t.tax)
  })
})

// ─── 9. Rounding edge cases ──────────────────────────────────────────────────
describe('rounding edge cases', () => {
  it('CLP tax is always integer even when net * 0.19 is fractional', () => {
    // 7 * 1 = 7 → tax = round(7 * 0.19) = round(1.33) = 1
    const q = makeQuote({
      items: [{ description: 'Odd', quantity: 7, unitPrice: 1, custom: {} }],
    })
    const t = computeTotals(q)
    assert.ok(Number.isInteger(t.tax), `tax ${t.tax} should be integer for CLP`)
  })

  it('adjustment amount is rounded to nearest peso for CLP', () => {
    // base = 1 * 333 = 333; utilidad 10% → 333 * 0.1 = 33.3 → rounds to 33
    const adjustments = defaultAdjustments().map((a) =>
      a.key === 'utilidad' ? { ...a, percent: 10, enabled: true } : a,
    )
    const q = makeQuote({
      items: [{ description: 'Fractional', quantity: 1, unitPrice: 333, custom: {} }],
      adjustments,
    })
    const t = computeTotals(q)
    assert.ok(Number.isInteger(t.adjustments[0].amount), 'CLP adjustment amount must be integer')
    assert.equal(t.adjustments[0].amount, 33)
  })

  it('taxRate=0 → tax=0, total=net', () => {
    const q = makeQuote({
      taxRate: 0,
      items: [{ description: 'Exento', quantity: 1, unitPrice: 5000, custom: {} }],
    })
    const t = computeTotals(q)
    assert.equal(t.tax, 0)
    assert.equal(t.total, t.net)
  })
})
