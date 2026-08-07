import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ticketModalityCode, ticketCodePrefix } from '../../src/lib/tickets/ticket-code.ts'

test('ticketModalityCode: pre_quote -> CP, post_execution -> EM', () => {
  assert.equal(ticketModalityCode('pre_quote'), 'CP')
  assert.equal(ticketModalityCode('post_execution'), 'EM')
})

// Instantes ancladas con sufijo 'Z' (UTC explícito) en vez de `new Date(2026, 7, 5)`
// (hora local del proceso) — así el test es determinístico sin importar en qué
// timezone corra la máquina/CI, no solo en la de este equipo (America/Santiago).
// 18:00 UTC = 14:00 Chile (UTC-4 en agosto) — mismo día calendario en ambos lados,
// sin riesgo de cruzar medianoche en ninguna de las dos lecturas.
const AUG_5_MIDDAY_UTC = new Date('2026-08-05T18:00:00Z')

test('ticketCodePrefix: formato YYMMDD-CLIENTE-SUCURSAL-MODALIDAD', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Happyland',
    branchName: 'Alto Las Condes',
    processFlow: 'pre_quote',
    date: AUG_5_MIDDAY_UTC,
  })
  assert.equal(prefix, '260805-HAPP-ALTOLASCONDES-CP')
})

test('ticketCodePrefix: emergencia usa EM', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Just Burger', branchName: 'La Reina', processFlow: 'post_execution',
    date: AUG_5_MIDDAY_UTC,
  })
  assert.equal(prefix, '260805-JUST-LAREINA-EM')
})

test('ticketCodePrefix: normaliza tildes/ñ y trunca igual que antes', () => {
  const prefix = ticketCodePrefix({
    clientPrefix: 'Peñaflor', branchName: 'Cerrajería Ñuñoa', processFlow: 'pre_quote',
    date: AUG_5_MIDDAY_UTC,
  })
  assert.equal(prefix, '260805-PENA-CERRAJERIANUNO-CP') // 4 letras cliente, 14 sucursal (brief decía 10 pero eso truncaba 'Alto Las Condes'/13 y no reproducía este caso — 14 es el valor que hace pasar ambos)
})

// Finding 1 (final-review): el segmento YYMMDD debe reflejar el día calendario
// en America/Santiago, no el del reloj del proceso (UTC en Vercel). 02:00 UTC
// del 6 de agosto es 22:00 del 5 de agosto en Chile (UTC-4) — un ticket creado
// a esa hora real debe quedar fechado 260805, nunca 260806.
test('ticketCodePrefix: usa el día calendario de Chile, no el de UTC (ticket creado ~22:00 hora Chile)', () => {
  const lateNightChile = new Date('2026-08-06T02:00:00Z')
  const prefix = ticketCodePrefix({
    clientPrefix: 'Happyland',
    branchName: 'Alto Las Condes',
    processFlow: 'pre_quote',
    date: lateNightChile,
  })
  assert.equal(prefix, '260805-HAPP-ALTOLASCONDES-CP')
})
