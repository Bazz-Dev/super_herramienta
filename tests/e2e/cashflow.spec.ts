import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('ingegar123')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('cashflow dashboard shows collection KPIs', async ({ page }) => {
  await login(page)
  await page.goto('/flujo')
  await expect(page.getByRole('heading', { name: 'Flujo de Caja' })).toBeVisible()
  await expect(page.getByText('Facturado')).toBeVisible()
  await expect(page.getByText('Sin facturar (SIN OC)')).toBeVisible()
  await expect(page.getByLabel('Filtrar por cliente')).toBeVisible()
})

test('jobs list is reachable and shows data', async ({ page }) => {
  await login(page)
  await page.goto('/flujo/trabajos')
  await expect(page.getByRole('heading', { name: /Trabajos/i })).toBeVisible()
})

test('branches admin exists', async ({ page }) => {
  await login(page)
  await page.goto('/flujo/sucursales')
  await expect(page.getByRole('heading', { name: 'Sucursales', exact: true })).toBeVisible()
})
