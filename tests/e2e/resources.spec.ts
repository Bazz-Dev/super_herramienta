import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('assets section shows seeded asset', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/activos')
  await expect(page.getByRole('heading', { name: 'Maquinaria / activos' })).toBeVisible()
  await expect(page.getByText('Contador de partículas')).toBeVisible()
})

test('crews section shows seeded crew with technicians', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/cuadrillas')
  await expect(page.getByText('Cuadrilla A')).toBeVisible()
  await expect(page.getByText(/Carlos Fuentes/)).toBeVisible()
})

test('schedule shows calendar and seeded assignment', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma')
  await expect(page.getByRole('heading', { name: 'Cronograma' })).toBeVisible()
  await expect(page.getByText('Mantención UMA — Alcon').first()).toBeVisible()
})
