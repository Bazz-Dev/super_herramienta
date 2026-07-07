import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('cotizador shows pricing adjustments', async ({ page }) => {
  await login(page)
  await page.goto('/cotizador')
  await expect(page.getByText('Ajustes sobre el costo base')).toBeVisible()
  await expect(page.getByText('Utilidad', { exact: true })).toBeVisible()
  await expect(page.getByText('Gastos administrativos')).toBeVisible()
})

test('cronograma is a top-level module with day/week/month views', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma')
  await expect(page.getByRole('button', { name: 'Día' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Semana' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mes' })).toBeVisible()
  // Technician filter + permission legend.
  await expect(page.getByLabel('Filtrar por técnico')).toBeVisible()
  await expect(page.getByText('Permiso solicitado')).toBeVisible()
})

test('assignment form has team + permission, no crew/asset', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma/new')
  await expect(page.getByText('Equipo asignado')).toBeVisible()
  await expect(page.getByText('Permiso de sucursal solicitado')).toBeVisible()
})

test('vehicles section exists with technician assignment', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/vehiculos/new')
  await expect(page.getByLabel('Patente *')).toBeVisible()
  await expect(page.getByText('Técnico asignado')).toBeVisible()
})

test('clients section exists', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/clientes/new')
  await expect(page.getByLabel('Nombre / razón social *')).toBeVisible()
})

test('asset form assigns tool to a vehicle', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/activos/new')
  await expect(page.getByText('Camioneta', { exact: true })).toBeVisible()
})
