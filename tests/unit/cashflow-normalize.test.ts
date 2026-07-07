import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMoneyCLP,
  parseCreditDays,
  normalizeType,
  normalizeCollectionStatus,
  normalizeBranchName,
} from '../../src/lib/cashflow/normalize.ts'

test('parseMoneyCLP', () => {
  assert.equal(parseMoneyCLP('$80.000'), 80000)
  assert.equal(parseMoneyCLP('$15.200,00'), 15200)
  assert.equal(parseMoneyCLP(95200), 95200)
  assert.equal(parseMoneyCLP(''), null)
  assert.equal(parseMoneyCLP(null), null)
})

test('parseCreditDays', () => {
  assert.equal(parseCreditDays('30 días'), 30)
  assert.equal(parseCreditDays('2 CUOTAS'), null)
  assert.equal(parseCreditDays(45), 45)
})

test('normalizeType', () => {
  assert.equal(normalizeType('Emergencia'), 'emergencia')
  assert.equal(normalizeType('Término preventivo'), 'preventivo')
  assert.equal(normalizeType('Requerimiento'), 'requerimiento')
  assert.equal(normalizeType('algo raro'), 'otro')
})

test('normalizeCollectionStatus', () => {
  assert.equal(normalizeCollectionStatus('PAGADO'), 'pagado')
  assert.equal(normalizeCollectionStatus('PENDIENTE PAGO'), 'pendiente_pago')
  assert.equal(normalizeCollectionStatus('SIN OC'), 'sin_oc')
  assert.equal(normalizeCollectionStatus(''), 'sin_oc')
})

test('normalizeBranchName merges redundant variants', () => {
  assert.equal(normalizeBranchName('Isidora '), 'Isidora')
  assert.equal(normalizeBranchName('QuilíN'), 'Quilín')
  assert.equal(normalizeBranchName('Quilin'), 'Quilín')
  assert.equal(normalizeBranchName('Huechurana'), 'Huechuraba')
  assert.equal(normalizeBranchName('Rotonda'), 'Rotonda Atenas')
  assert.equal(normalizeBranchName('Dk La Florida'), 'La Florida')
  assert.equal(normalizeBranchName('Dk Lo Barnechea'), 'Lo Barnechea')
  assert.equal(normalizeBranchName('ViñA'), 'Viña del Mar')
})
