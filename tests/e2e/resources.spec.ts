import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('assets section renders list page', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/activos')
  await page.waitForLoadState('load')
  await expect(page.getByRole('heading', { name: 'Maquinaria / activos' })).toBeVisible({ timeout: 15000 })
  // Seeded asset "Contador de partículas" exists only on fresh DB — check page renders regardless
  await expect(page.locator('h1').first()).not.toHaveText(/not found/i)
})

test('crews section renders list page', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/cuadrillas')
  await page.waitForLoadState('load')
  await expect(page.getByRole('heading', { name: 'Cuadrillas' })).toBeVisible({ timeout: 15000 })
  // If seeded, "Cuadrilla A" exists with "Jesús Díaz" (renamed from "Carlos Fuentes")
  const cuadrillaA = page.getByText('Cuadrilla A')
  const count = await cuadrillaA.count()
  if (count > 0) {
    await expect(cuadrillaA.first()).toBeVisible()
    await expect(page.getByText(/Jesús Díaz/).first()).toBeVisible()
  }
})

test('schedule shows calendar', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma')
  await page.waitForLoadState('load')
  await expect(page.getByRole('heading', { name: 'Cronograma' })).toBeVisible({ timeout: 15000 })
  // Seeded assignment "Mantención UMA — Alcon" may exist; just verify calendar renders
  await expect(page.locator('h1').first()).not.toHaveText(/not found/i)
})
