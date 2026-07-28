import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('cashflow dashboard shows collection KPIs', async ({ page }) => {
  await login(page)
  await page.goto('/flujo')
  await page.waitForLoadState('load')
  await expect(page.getByRole('heading', { name: 'Flujo de Caja' })).toBeVisible()
  // "Control de hoy" reemplazó los KPIs de cobranza antiguos ("Facturado" /
  // "Sin facturar (SIN OC)" ya no existen desde el rediseño a 4 indicadores
  // de excepción) — ver src/app/(app)/flujo/page.tsx.
  await expect(page.getByRole('heading', { name: 'Control de hoy' })).toBeVisible()
  await expect(page.getByText('Facturas vencidas', { exact: true })).toBeVisible()
  await expect(page.getByText('Ejecutados sin OC', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Filtrar por cliente')).toBeVisible()
})

test('jobs list is reachable and shows data', async ({ page }) => {
  await login(page)
  // /flujo/trabajos es un redirect a /flujo/reportes desde el rediseño de
  // Reportes como destino propio de navegación — la lista real de trabajos
  // vive en /flujo mismo.
  await page.goto('/flujo/trabajos')
  await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible()
  await page.goto('/flujo')
  await expect(page.getByRole('heading', { name: 'Flujo de Caja' })).toBeVisible()
  await expect(page.getByText('Trabajos', { exact: true })).toBeVisible()
})

test('branches admin exists', async ({ page }) => {
  await login(page)
  await page.goto('/flujo/sucursales')
  await expect(page.getByRole('heading', { name: 'Sucursales', exact: true })).toBeVisible()
})
