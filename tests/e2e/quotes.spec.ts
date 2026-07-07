import { test, expect } from '@playwright/test'
import { sampleQuote } from '../../src/lib/quotes/sample'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('cotizador renders the quote preview', async ({ page }) => {
  await login(page)
  await page.goto('/cotizador')
  await expect(page.getByRole('heading', { name: 'Generador de Propuesta Técnico Comercial' })).toBeVisible()
  await expect(page.locator('iframe[title="Vista previa de cotización"]')).toBeVisible()
})

test('generate endpoint returns a PDF for an authenticated user', async ({ page }) => {
  await login(page)
  const res = await page.request.post('/api/quotes/generate', { data: sampleQuote })
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('application/pdf')
  const body = await res.body()
  expect(body.length).toBeGreaterThan(1000)
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('generate endpoint rejects unauthenticated requests', async ({ request }) => {
  const res = await request.post('/api/quotes/generate', { data: sampleQuote })
  expect(res.status()).toBe(401)
})
