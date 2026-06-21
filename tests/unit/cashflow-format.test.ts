import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clp, pct } from '../../src/lib/cashflow/format'

test('clp formats CLP without decimals', () => {
  assert.equal(clp(73135006).replace(/ /g, ' '), '$73.135.006')
  assert.equal(clp(null).replace(/ /g, ' '), '$0')
})
test('pct', () => {
  assert.equal(pct(0.6), '60%')
  assert.equal(pct(null), '—')
})
