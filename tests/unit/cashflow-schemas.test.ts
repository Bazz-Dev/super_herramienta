import { test } from 'node:test'
import assert from 'node:assert/strict'
import { jobInput, jobCostInput } from '../../src/lib/cashflow/schemas.ts'
import { toDateInput, fromDateInput } from '../../src/lib/cashflow/dates.ts'

test('jobInput: requires description + branchId, coerces numbers', () => {
  const ok = jobInput.safeParse({ clientId: 'c1', branchId: 'b1', description: 'X', netAmount: '80000' })
  assert.ok(ok.success)
  assert.equal(ok.data.netAmount, 80000)
  assert.equal(ok.data.collectionStatus, 'sin_oc')
})

test('jobInput: rejects empty description', () => {
  const bad = jobInput.safeParse({ clientId: 'c1', branchId: 'b1', description: '' })
  assert.equal(bad.success, false)
})

test('jobCostInput: coerces amount', () => {
  const ok = jobCostInput.safeParse({ jobId: 'j1', amount: '15000' })
  assert.ok(ok.success)
  assert.equal(ok.data.amount, 15000)
})

test('date helpers round-trip', () => {
  assert.equal(toDateInput(new Date('2026-04-01T00:00:00.000Z')), '2026-04-01')
  assert.equal(fromDateInput('2026-04-01')?.toISOString(), '2026-04-01T00:00:00.000Z')
  assert.equal(fromDateInput(''), null)
})
