import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ownedDocState, linkedDocState, isPendingSchedule,
  isPaidJob, isPartiallyPaidJob, hasPurchaseOrder, hasInvoiceInfo, isOverdueV2,
  isInstallmentPaid, isInstallmentOverdue, jobInstallmentsSummary,
} from '../../src/lib/cashflow/job-presets.ts'

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

// --- Cuotas (informe #12) — job-presets.ts debe seguir leyendo los campos
// planos exacto igual que antes cuando `installments` no viene en la query
// (la inmensa mayoría de los jobs) y cambiar de fuente solo cuando sí viene.

test('sin installments: predicados leen los campos planos de siempre (compat total)', () => {
  const job = { ...baseJob, purchaseOrder: 'OC-1', invoiceNumber: 'FAC-1', invoiceDate: new Date('2026-01-01'), financialStage: 'paid' }
  assert.equal(hasPurchaseOrder(job), true)
  assert.equal(hasInvoiceInfo(job), true)
  assert.equal(isPaidJob(job), true)
})

test('con installments vacío (array presente pero length 0): se comporta como sin installments', () => {
  const job = { ...baseJob, purchaseOrder: 'OC-1', installments: [] }
  assert.equal(hasPurchaseOrder(job), true)
})

test('isPaidJob con installments: todas pagadas → true, una sin pagar → false', () => {
  const paidJob = { ...baseJob, installments: [{ netAmount: 1000, paymentAmount: 1000, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: new Date() }] }
  assert.equal(isPaidJob(paidJob), true)

  const partialJob = { ...baseJob, installments: [
    { netAmount: 1000, paymentAmount: 1000, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: new Date() },
    { netAmount: 500, paymentAmount: null, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null },
  ] }
  assert.equal(isPaidJob(partialJob), false, 'cerrar una cuota no cierra el trabajo si quedan otras pendientes (criterio de aceptación #12)')
})

test('isInstallmentOverdue: factura vencida sin pago → true; pagada → false aunque esté vencida', () => {
  const now = new Date('2026-06-01')
  const overdue = { netAmount: 1000, paymentAmount: null, invoiceDate: new Date('2026-01-01'), creditDays: 30, purchaseOrder: null, invoiceNumber: null, paymentDate: null }
  assert.equal(isInstallmentOverdue(overdue, now), true)
  assert.equal(isInstallmentOverdue({ ...overdue, paymentAmount: 1000 }, now), false)
})

test('jobInstallmentsSummary: saldo total = suma de saldos (criterio de aceptación #12)', () => {
  const installments = [
    { netAmount: 1000, paymentAmount: 1000, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null },
    { netAmount: 500, paymentAmount: 200, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null },
    { netAmount: 300, paymentAmount: null, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null },
  ]
  const s = jobInstallmentsSummary(installments)
  assert.equal(s.totalNet, 1800)
  assert.equal(s.totalPaid, 1200)
  assert.equal(s.balance, 600)
  assert.equal(s.allPaid, false)
})

test('isInstallmentPaid: sin netAmount nunca se considera pagada (evita 0-0=0 falso positivo)', () => {
  assert.equal(isInstallmentPaid({ netAmount: null, paymentAmount: null, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null }), false)
})

test('isOverdueV2 con installments: vencida en una cuota basta para marcar el trabajo vencido', () => {
  const now = new Date('2026-06-01')
  const job = { ...baseJob, nonBillable: false, installments: [
    { netAmount: 1000, paymentAmount: 1000, invoiceDate: new Date('2026-01-01'), creditDays: 30, purchaseOrder: null, invoiceNumber: null, paymentDate: new Date() },
    { netAmount: 500, paymentAmount: null, invoiceDate: new Date('2026-01-01'), creditDays: 30, purchaseOrder: null, invoiceNumber: null, paymentDate: null },
  ] }
  assert.equal(isOverdueV2(job, now), true)
})

// --- purchaseOrderStatus (informe #11) — una OC anulada ya no cuenta como
// OC vigente, pero el histórico sin este campo (null) se sigue leyendo
// exactamente igual que antes de que existiera.

test('hasPurchaseOrder: sin purchaseOrderStatus (histórico) — se comporta exacto igual que antes', () => {
  const job = { ...baseJob, purchaseOrder: 'OC-1' }
  assert.equal(hasPurchaseOrder(job), true)
})

test('hasPurchaseOrder: purchaseOrderStatus="anulada" — ya no cuenta como OC vigente', () => {
  const job = { ...baseJob, purchaseOrder: 'OC-1', purchaseOrderStatus: 'anulada' }
  assert.equal(hasPurchaseOrder(job), false)
})

test('hasPurchaseOrder: purchaseOrderStatus="vigente" — sigue contando (comportamiento normal)', () => {
  const job = { ...baseJob, purchaseOrder: 'OC-1', purchaseOrderStatus: 'vigente' }
  assert.equal(hasPurchaseOrder(job), true)
})

test('hasPurchaseOrder con installments: una OC anulada no cuenta, otra vigente en la misma lista sí', () => {
  const job = { ...baseJob, installments: [
    { netAmount: 1000, purchaseOrder: 'OC-1', purchaseOrderStatus: 'anulada', invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null, paymentAmount: null },
    { netAmount: 500, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null, paymentAmount: null },
  ] }
  assert.equal(hasPurchaseOrder(job), false)
  ;(job.installments[1] as { purchaseOrder: string | null }).purchaseOrder = 'OC-2'
  assert.equal(hasPurchaseOrder(job), true)
})

// --- invoiceStatus / paymentAmount (informe #13) — mismo criterio que
// purchaseOrderStatus: histórico sin el campo se comporta exacto igual que
// antes; solo un valor explícito "anulada" excluye, nunca se infiere.

test('hasInvoiceInfo: sin invoiceStatus (histórico) — se comporta exacto igual que antes', () => {
  const job = { ...baseJob, invoiceNumber: 'FAC-1' }
  assert.equal(hasInvoiceInfo(job), true)
})

test('hasInvoiceInfo: invoiceStatus="anulada" — ya no cuenta como factura vigente', () => {
  const job = { ...baseJob, invoiceNumber: 'FAC-1', invoiceStatus: 'anulada' }
  assert.equal(hasInvoiceInfo(job), false)
})

test('isPaidJob: paymentAmount >= netAmount (sin señales clásicas) → pagado', () => {
  const job = { ...baseJob, netAmount: 1000, paymentAmount: 1000 }
  assert.equal(isPaidJob(job), true)
})

test('isPaidJob: paymentAmount < netAmount → NO pagado (es parcial, no total)', () => {
  const job = { ...baseJob, netAmount: 1000, paymentAmount: 400 }
  assert.equal(isPaidJob(job), false)
})

test('isPaidJob: paymentDate seteado SIN cubrir el monto → NO pagado (regresión real: paymentAmount manda sobre paymentDate)', () => {
  // Encontrado en verificación en vivo de este bloque: guardar "Fecha de
  // pago" + un monto parcial desde el form general (updateJob, no
  // markJobPaid) seteaba paymentDate != null, y el fallback clásico
  // (paymentDate != null → pagado) lo leía como pago TOTAL a pesar de que
  // paymentAmount < netAmount decía lo contrario.
  const job = { ...baseJob, netAmount: 100000, paymentAmount: 40000, paymentDate: new Date('2026-08-03') }
  assert.equal(isPaidJob(job), false)
})

test('isPaidJob: señales clásicas (financialStage=paid) siguen ganando aunque paymentAmount sea null — compat total', () => {
  const job = { ...baseJob, financialStage: 'paid', netAmount: 1000, paymentAmount: null }
  assert.equal(isPaidJob(job), true)
})

test('isPartiallyPaidJob: paymentAmount > 0 y < netAmount → true', () => {
  const job = { ...baseJob, netAmount: 1000, paymentAmount: 400 }
  assert.equal(isPartiallyPaidJob(job), true)
})

test('isPartiallyPaidJob: sin pago (paymentAmount null) → false', () => {
  const job = { ...baseJob, netAmount: 1000, paymentAmount: null }
  assert.equal(isPartiallyPaidJob(job), false)
})

test('isPartiallyPaidJob: ya pagado total → false (nunca "parcial" y "pagado" a la vez)', () => {
  const job = { ...baseJob, netAmount: 1000, paymentAmount: 1000 }
  assert.equal(isPartiallyPaidJob(job), false)
})

test('isPartiallyPaidJob con installments: alguna cuota con pago > 0, ninguna cubre el total → true', () => {
  const job = { ...baseJob, installments: [
    { netAmount: 1000, paymentAmount: 300, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null },
    { netAmount: 500, paymentAmount: null, purchaseOrder: null, invoiceNumber: null, invoiceDate: null, creditDays: null, paymentDate: null },
  ] }
  assert.equal(isPartiallyPaidJob(job), true)
  assert.equal(isPaidJob(job), false)
})
