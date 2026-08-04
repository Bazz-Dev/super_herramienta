import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditLogWhere } from '../../src/lib/audit-query.ts'

// Aislamiento por tenant (informe #32B) — prueba explícita, no solo
// inspección de código: mismo criterio ya usado en tenantScope() (super ve
// todo, el resto queda scopeado a su propio tenantId).

test('supervisor: la query queda scopeada a su tenantId (nunca ve otros tenants)', () => {
  const where = auditLogWhere({ role: 'supervisor', tenantId: 'tenant-a' }, {})
  assert.equal(where.tenantId, 'tenant-a')
})

test('super: sin restricción de tenantId (ve todos, mismo criterio que tenantScope)', () => {
  const where = auditLogWhere({ role: 'super', tenantId: 'tenant-a' }, {})
  assert.equal('tenantId' in where, false)
})

test('un actor de tenant-a nunca puede forzar ver tenant-b vía filtros', () => {
  // Ningún filtro de la página (actor/entityType/entityId/action/source)
  // puede sobrescribir tenantId — no existe un parámetro "tenantId" expuesto.
  const where = auditLogWhere({ role: 'supervisor', tenantId: 'tenant-a' }, { entityType: 'Job', action: 'job.delete' })
  assert.equal(where.tenantId, 'tenant-a')
  assert.equal(where.entityType, 'Job')
})

test('filtros combinados no rompen el aislamiento por tenant', () => {
  const where = auditLogWhere(
    { role: 'supervisor', tenantId: 'tenant-a' },
    { desde: '2026-01-01', hasta: '2026-12-31', actor: 'Carolina', entityType: 'Secret', entityId: 'x', action: 'secret', source: 'credenciales' },
  )
  assert.equal(where.tenantId, 'tenant-a')
})
