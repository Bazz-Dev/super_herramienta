import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDownloadFilename } from '../../src/lib/tickets/file-naming.ts'

test('presupuesto con número y ticket', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'presupuesto', number: '20000', ticketCode: '260805-HAPP-ALTOLASCONDES-CP1' }),
    'PRESUPUESTO_20000_260805-HAPP-ALTOLASCONDES-CP1.pdf',
  )
})

test('factura con número y ticket', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'factura', number: '1350', ticketCode: '260805-HAPP-ALTOLASCONDES-CP1' }),
    'FACTURA_1350_260805-HAPP-ALTOLASCONDES-CP1.pdf',
  )
})

test('oc con extensión no-pdf', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'oc', number: 'X-5030', ticketCode: '260805-HAPP-ALTOLASCONDES-CP1', ext: 'jpg' }),
    'OC_X-5030_260805-HAPP-ALTOLASCONDES-CP1.jpg',
  )
})

test('informe técnico no lleva número', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'informe_tecnico', ticketCode: '260805-HAPP-ALTOLASCONDES-CP1' }),
    'INFORME_TECNICO_260805-HAPP-ALTOLASCONDES-CP1.pdf',
  )
})

test('sin ticket vinculado — se omite ese segmento, no queda un guion colgando', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'presupuesto', number: '20000', ticketCode: null }),
    'PRESUPUESTO_20000.pdf',
  )
})

test('sin número (presupuesto/factura/oc todavía sin asignar) — se omite ese segmento', () => {
  assert.equal(
    buildDownloadFilename({ kind: 'presupuesto', number: null, ticketCode: '260805-HAPP-ALTOLASCONDES-CP1' }),
    'PRESUPUESTO_260805-HAPP-ALTOLASCONDES-CP1.pdf',
  )
})
