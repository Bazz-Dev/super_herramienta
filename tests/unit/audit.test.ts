import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as auditModule from '../../src/lib/audit.ts'
import { logAudit } from '../../src/lib/audit.ts'

// sanitize() corre DENTRO del literal `data: {...}` pasado a
// prisma.auditLog.create() — si tira, lo hace ANTES de que create() llegue a
// tocar la base, así que estos tests no necesitan una DB real conectada:
// el rechazo pasa en la construcción de argumentos, nunca llega a Prisma.

const base = {
  tenantId: 't1', actorRole: 'super', action: 'test.action',
  entityType: 'Test', entityId: 'e1', source: 'test',
}

test('logAudit rechaza (no redacta en silencio) si "before" trae un campo con "password"', async () => {
  await assert.rejects(
    () => logAudit({ ...base, before: { passwordHash: 'x', name: 'ok' } }),
    /campo sospechoso "passwordHash"/,
  )
})

test('logAudit rechaza si "after" trae "ciphertext" (bóveda de secretos)', async () => {
  await assert.rejects(
    () => logAudit({ ...base, after: { ciphertext: 'aes-encrypted-blob' } }),
    /campo sospechoso "ciphertext"/,
  )
})

test('logAudit rechaza "token"/"secret"/"signedUrl"/"apiKey" en cualquier caja de letras', async () => {
  for (const key of ['token', 'refreshToken', 'secretValue', 'signedUrl', 'apiKey']) {
    await assert.rejects(() => logAudit({ ...base, before: { [key]: 'x' } }), new RegExp(key, 'i'))
  }
})

// Append-only (informe #32B, regla no negociable): src/lib/audit.ts es el
// ÚNICO punto de escritura de AuditLog en todo el código (no hay
// updateAudit/deleteAudit en ningún lado — confirmado por grep) — esta
// prueba estructural falla si alguien agrega esas funciones sin darse cuenta
// de que rompe la regla.
test('audit.ts expone solo logAudit — nada para editar o borrar un registro', () => {
  const exported = Object.keys(auditModule)
  assert.deepEqual(exported, ['logAudit'])
})
