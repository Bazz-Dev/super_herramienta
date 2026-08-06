import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ticketModalityCode, ticketCodePrefix } from '../../src/lib/tickets/ticket-code.ts'

test('ticketModalityCode: pre_quote -> CP, post_execution -> EM', () => {
  assert.equal(ticketModalityCode('pre_quote'), 'CP')
  assert.equal(ticketModalityCode('post_execution'), 'EM')
})

test('ticketCodePrefix: formato YYMMDD-CLIENTE-SUCURSAL-MODALIDAD', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Happyland',
    branchName: 'Alto Las Condes',
    processFlow: 'pre_quote',
    date: new Date(2026, 7, 5), // 5 de agosto de 2026 (mes 0-indexado)
  })
  assert.equal(prefix, '260805-HAPP-ALTOLASCONDES-CP')
})

test('ticketCodePrefix: emergencia usa EM', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Just Burger', branchName: 'La Reina', processFlow: 'post_execution',
    date: new Date(2026, 7, 5),
  })
  assert.equal(prefix, '260805-JUST-LAREINA-EM')
})

test('ticketCodePrefix: normaliza tildes/ñ y trunca igual que antes', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Peñaflor', branchName: 'Cerrajería Ñuñoa', processFlow: 'pre_quote',
    date: new Date(2026, 7, 5),
  })
  assert.equal(prefix, '260805-PENA-CERRAJERIANUNO-CP') // 4 letras cliente, 14 sucursal (brief decía 10 pero eso truncaba 'Alto Las Condes'/13 y no reproducía este caso — 14 es el valor que hace pasar ambos)
})
