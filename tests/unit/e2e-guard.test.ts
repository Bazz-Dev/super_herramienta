import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertSafeE2EDatabaseUrl, assertSafeE2EBaseUrl } from '../e2e/env-guard.ts'

// G19: el guard debe hacer IMPOSIBLE que los E2E apunten a producción.

test('guard DB: rechaza E2E_DATABASE_URL ausente (sin fallback a DATABASE_URL)', () => {
  assert.throws(() => assertSafeE2EDatabaseUrl(undefined), /E2E_DATABASE_URL/)
})

test('guard DB: rechaza libsql:// (Turso producción)', () => {
  assert.throws(() => assertSafeE2EDatabaseUrl('libsql://ingegar-prod.turso.io'), /remota|producción/)
})

test('guard DB: rechaza hostname de turso.io en cualquier forma', () => {
  assert.throws(() => assertSafeE2EDatabaseUrl('https://algo.turso.io'))
})

test('guard DB: rechaza URLs https/wss remotas', () => {
  assert.throws(() => assertSafeE2EDatabaseUrl('https://db.example.com'))
  assert.throws(() => assertSafeE2EDatabaseUrl('wss://db.example.com'))
})

test('guard DB: acepta file: local y la devuelve', () => {
  assert.equal(assertSafeE2EDatabaseUrl('file:./prisma/e2e.db'), 'file:./prisma/e2e.db')
})

test('guard baseURL: rechaza el dominio de producción', () => {
  assert.throws(() => assertSafeE2EBaseUrl('https://super-herramienta.vercel.app'), /producción/)
})

test('guard baseURL: rechaza cualquier *.vercel.app', () => {
  assert.throws(() => assertSafeE2EBaseUrl('https://otra-app.vercel.app'))
})

test('guard baseURL: rechaza hosts no locales', () => {
  assert.throws(() => assertSafeE2EBaseUrl('https://ingegarchile.cl'))
})

test('guard baseURL: acepta 127.0.0.1 y localhost', () => {
  assert.doesNotThrow(() => assertSafeE2EBaseUrl('http://127.0.0.1:3000'))
  assert.doesNotThrow(() => assertSafeE2EBaseUrl('http://localhost:3001'))
})
