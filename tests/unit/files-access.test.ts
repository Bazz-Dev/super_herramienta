import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ticketFileFilter } from '../../src/lib/files-access.ts'

test('super: sin filtro, ve cualquier ticket', () => {
  assert.equal(ticketFileFilter('super', 't1', 'u1', null), undefined)
})

test('client con clientId: scopeado a tenant+cliente', () => {
  assert.deepEqual(ticketFileFilter('client', 't1', 'u1', 'c1'), { tenantId: 't1', clientId: 'c1' })
})

test('client sin clientId: match imposible, nunca todo el tenant', () => {
  assert.deepEqual(ticketFileFilter('client', 't1', 'u1', null), { tenantId: 't1', clientId: '' })
})

test('tecnico: scopeado a tenant+assignedToId (G48 — antes no filtraba por asignación)', () => {
  assert.deepEqual(ticketFileFilter('tecnico', 't1', 'tech-1', null), { tenantId: 't1', assignedToId: 'tech-1' })
})

test('tecnico nunca ve el ticket asignado a otro técnico del mismo tenant', () => {
  const filterA = ticketFileFilter('tecnico', 't1', 'tech-A', null)
  const filterB = ticketFileFilter('tecnico', 't1', 'tech-B', null)
  assert.notEqual(filterA?.assignedToId, filterB?.assignedToId)
})

test('supervisor: scopeado solo a tenant (staff interno, no a cliente/técnico específico)', () => {
  assert.deepEqual(ticketFileFilter('supervisor', 't1', 'u1', null), { tenantId: 't1' })
})
