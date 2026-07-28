import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownedDocState, linkedDocState, isPendingSchedule } from '../../src/lib/cashflow/job-presets.ts'

const baseJob = {
  financialStage: 'no_po',
  commercialStage: 'intake',
  operationalStage: 'pending',
  nonBillable: false,
  netAmount: null,
  purchaseOrder: null,
  invoiceNumber: null,
  invoiceDate: null,
  paymentDate: null,
  executionDate: null,
  creditDays: null,
}

test('isPendingSchedule: no technician + not executed → true', () => {
  assert.equal(isPendingSchedule({ ...baseJob, technicianId: null }), true)
})

test('isPendingSchedule: technician assigned → false regardless of execution', () => {
  assert.equal(isPendingSchedule({ ...baseJob, technicianId: 't1' }), false)
})

test('isPendingSchedule: already executed (legacy status) without technician → false', () => {
  assert.equal(isPendingSchedule({ ...baseJob, technicianId: null, status: 'ejecutado' }), false)
})

test('isPendingSchedule: already executed (executionDate set) without technician → false', () => {
  assert.equal(isPendingSchedule({ ...baseJob, technicianId: null, executionDate: new Date('2026-01-01') }), false)
})

test('ownedDocState: no number and no file → falta', () => {
  assert.equal(ownedDocState(null, null), 'falta')
  assert.equal(ownedDocState('', null), 'falta')
})

test('ownedDocState: number present, no file → registrado', () => {
  assert.equal(ownedDocState('OC-123', null), 'registrado')
})

test('ownedDocState: file present → adjunto, regardless of number', () => {
  assert.equal(ownedDocState(null, 'jobs/x/oc.pdf'), 'adjunto')
  assert.equal(ownedDocState('OC-123', 'jobs/x/oc.pdf'), 'adjunto')
})

test('linkedDocState: falta when no value, vinculado when present', () => {
  assert.equal(linkedDocState(null), 'falta')
  assert.equal(linkedDocState(undefined), 'falta')
  assert.equal(linkedDocState('doc-id-123'), 'vinculado')
})
