import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics, jobMargin, jobIsOverdue, type JobLike } from '../../src/lib/cashflow/metrics.ts'

const base: JobLike = {
  netAmount: 100000, taxAmount: 19000, collectionStatus: 'sin_oc',
  executionDate: null, invoiceDate: null, paymentDate: null, creditDays: null,
  type: 'requerimiento', branchId: 'b1', technicianId: null, clientId: 'c1', costs: [],
}
const NOW = new Date('2026-06-19T00:00:00.000Z')

test('sin_oc feeds the backlog, not facturado', () => {
  const m = computeMetrics([{ ...base }], NOW)
  assert.equal(m.sinOcBacklog, 100000)
  assert.equal(m.sinOcCount, 1)
  assert.equal(m.facturado, 0)
})

test('pendiente_pago counts as por cobrar; overdue when past due date', () => {
  const j: JobLike = {
    ...base, collectionStatus: 'pendiente_pago',
    invoiceDate: new Date('2026-04-01T00:00:00.000Z'), creditDays: 30,
  }
  assert.equal(jobIsOverdue(j, NOW), true)
  const m = computeMetrics([j], NOW)
  assert.equal(m.porCobrar, 100000)
  assert.equal(m.vencido, 100000)
  assert.equal(m.aging.find((a) => a.bucket === '60+')!.amount, 100000)
})

test('pagado counts as cobrado and feeds avg collection days', () => {
  const j: JobLike = {
    ...base, collectionStatus: 'pagado',
    invoiceDate: new Date('2026-04-01T00:00:00.000Z'),
    paymentDate: new Date('2026-05-01T00:00:00.000Z'),
  }
  const m = computeMetrics([j], NOW)
  assert.equal(m.cobrado, 100000)
  assert.equal(m.avgCollectionDays, 30)
})

test('margin only when costs exist', () => {
  assert.deepEqual(jobMargin({ ...base }), { margin: null, marginPct: null })
  const withCost = jobMargin({ ...base, costs: [{ amount: 40000 }] })
  assert.equal(withCost.margin, 60000)
  assert.equal(Math.round(withCost.marginPct! * 100), 60)
})

test('mix aggregates by type', () => {
  const m = computeMetrics(
    [{ ...base, type: 'emergencia' }, { ...base, type: 'emergencia' }, { ...base, type: 'preventivo' }],
    NOW,
  )
  assert.equal(m.mix.find((x) => x.type === 'emergencia')!.count, 2)
})
