import { test } from 'node:test'
import assert from 'node:assert/strict'
import { comercialState, isProposalApproved, canStartExecution, financialState } from '../../src/lib/tickets/ticket-state-summary.ts'

// Informe #2 (modalidades PP/ED) — comercialState() gana un 3er caso derivado
// "pendiente_valorizacion" para ED (post_execution) sin propuesta/job, y dos
// funciones puras nuevas para el gate de ejecución de PP (pre_quote).

test('comercialState: ED sin propuesta pero ya resuelto -> pendiente_valorizacion (no "sin_propuesta")', () => {
  const s = comercialState(null, null, { processFlow: 'post_execution', status: 'resuelto' })
  assert.equal(s, 'pendiente_valorizacion')
})

test('comercialState: ED sin propuesta y en ejecución -> pendiente_valorizacion', () => {
  const s = comercialState(null, null, { processFlow: 'post_execution', status: 'en_ejecucion' })
  assert.equal(s, 'pendiente_valorizacion')
})

test('comercialState: ED sin propuesta y todavía nuevo -> sin_propuesta (no arrancó, no hay nada que valorizar aún)', () => {
  const s = comercialState(null, null, { processFlow: 'post_execution', status: 'nuevo' })
  assert.equal(s, 'sin_propuesta')
})

test('comercialState: PP sin propuesta -> sin_propuesta, nunca pendiente_valorizacion (esa etiqueta es solo de ED)', () => {
  const s = comercialState(null, null, { processFlow: 'pre_quote', status: 'resuelto' })
  assert.equal(s, 'sin_propuesta')
})

test('comercialState: sin ticket (compatibilidad hacia atrás, firma de 2 args) -> igual que antes', () => {
  const s = comercialState(null, { proposalStatus: 'enviada' })
  assert.equal(s, 'enviada')
})

test('comercialState: job con commercialStage aprobado manda sobre el fallback de ED', () => {
  // comercialState() solo lee job.commercialStage en esta rama — el resto de
  // JobLike (campos financieros) no aplica a esta pregunta puntual.
  const job = { commercialStage: 'approved' } as Parameters<typeof comercialState>[0]
  const s = comercialState(job, null, { processFlow: 'post_execution', status: 'resuelto' })
  assert.equal(s, 'aprobada')
})

test('isProposalApproved: true si el job tiene commercialStage=approved', () => {
  assert.equal(isProposalApproved({ commercialStage: 'approved' }, null), true)
})

test('isProposalApproved: true si la propuesta fue aceptada (sin job todavía)', () => {
  assert.equal(isProposalApproved(null, { proposalStatus: 'aceptada' }), true)
})

test('isProposalApproved: false sin job ni propuesta aceptada', () => {
  assert.equal(isProposalApproved(null, null), false)
  assert.equal(isProposalApproved(null, { proposalStatus: 'enviada' }), false)
  assert.equal(isProposalApproved({ commercialStage: 'quote_sent' }, null), false)
})

test('canStartExecution: PP (pre_quote) bloquea sin aprobación', () => {
  assert.equal(canStartExecution('pre_quote', false), false)
})

test('canStartExecution: PP (pre_quote) permite con aprobación', () => {
  assert.equal(canStartExecution('pre_quote', true), true)
})

test('canStartExecution: ED (post_execution) nunca bloquea', () => {
  assert.equal(canStartExecution('post_execution', false), true)
})

test('canStartExecution: ticket histórico sin modalidad (null) nunca bloquea — la regla no es retroactiva', () => {
  assert.equal(canStartExecution(null, false), true)
})

// --- financialState (informe #13) — nuevo caso "parcial" entre "facturada"
// y "vencida"/"pagada". Mismo criterio: vencida sigue ganando si un pago
// parcial además está vencido (igual que isOverdueV2 ya trata cuotas
// parcialmente pagadas).

const baseJob = {
  financialStage: 'invoiced', commercialStage: 'approved', operationalStage: 'executed', nonBillable: false,
  netAmount: 1000, purchaseOrder: 'OC-1', invoiceNumber: 'FAC-1', invoiceDate: new Date('2026-01-01'),
  paymentDate: null, executionDate: new Date('2026-01-01'), creditDays: 30,
}

test('financialState: sin trabajo -> sin_trabajo', () => {
  assert.equal(financialState(null), 'sin_trabajo')
})

test('financialState: pago parcial, no vencido -> parcial', () => {
  const job = { ...baseJob, invoiceDate: new Date(), paymentAmount: 400 }
  assert.equal(financialState(job), 'parcial')
})

test('financialState: pago total -> pagada, nunca parcial', () => {
  const job = { ...baseJob, invoiceDate: new Date(), paymentAmount: 1000 }
  assert.equal(financialState(job), 'pagada')
})

test('financialState: pago parcial pero vencido -> vencida gana sobre parcial', () => {
  const job = { ...baseJob, invoiceDate: new Date('2020-01-01'), creditDays: 30, paymentAmount: 400 }
  assert.equal(financialState(job), 'vencida')
})

test('financialState: sin pago, con factura reciente -> facturada (no parcial)', () => {
  const job = { ...baseJob, invoiceDate: new Date(), paymentAmount: null }
  assert.equal(financialState(job), 'facturada')
})
