import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expenseClassification, isConfirmedExpense, directExpenseTotal } from '../../src/lib/expenses/expense-presets.ts'

// Informe #14 — clasificación directo/general/sin_clasificar y total de
// gastos confirmados. Mismo criterio ya usado en la ficha del ticket
// ("... aprobado"): solo aprobado/pagado cuenta como costo real.

test('expenseClassification: con ticketId -> siempre directo, sin importar isGeneral', () => {
  assert.equal(expenseClassification({ ticketId: 't1', isGeneral: null }), 'directo')
  assert.equal(expenseClassification({ ticketId: 't1', isGeneral: true }), 'directo')
})

test('expenseClassification: sin ticket e isGeneral=true -> general', () => {
  assert.equal(expenseClassification({ ticketId: null, isGeneral: true }), 'general')
})

test('expenseClassification: sin ticket e isGeneral=null (histórico, nunca revisado) -> sin_clasificar', () => {
  assert.equal(expenseClassification({ ticketId: null, isGeneral: null }), 'sin_clasificar')
})

test('expenseClassification: sin ticket e isGeneral=false explícito -> sin_clasificar (no se infiere general)', () => {
  assert.equal(expenseClassification({ ticketId: null, isGeneral: false }), 'sin_clasificar')
})

test('isConfirmedExpense: aprobado y pagado cuentan, pendiente y rechazado no', () => {
  assert.equal(isConfirmedExpense({ status: 'aprobado' }), true)
  assert.equal(isConfirmedExpense({ status: 'pagado' }), true)
  assert.equal(isConfirmedExpense({ status: 'pendiente' }), false)
  assert.equal(isConfirmedExpense({ status: 'rechazado' }), false)
})

test('directExpenseTotal: suma solo confirmados', () => {
  const total = directExpenseTotal([
    { amount: 10000, status: 'aprobado' },
    { amount: 5000, status: 'pendiente' },
    { amount: 8000, status: 'pagado' },
    { amount: 3000, status: 'rechazado' },
  ])
  assert.equal(total, 18000)
})

test('directExpenseTotal: array vacío -> 0', () => {
  assert.equal(directExpenseTotal([]), 0)
})
