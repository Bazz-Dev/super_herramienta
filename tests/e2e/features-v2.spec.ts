import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña').fill('ingegar123')
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

test('schedule has day/week/month views', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/cronograma')
  await expect(page.getByRole('button', { name: 'Día' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Semana' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mes' })).toBeVisible()
})

test('technician form has vehicle plate', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/tecnicos/new')
  await expect(page.getByLabel('Patente vehículo / camioneta')).toBeVisible()
})

test('asset form has holder (camioneta) select', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/activos/new')
  await expect(page.getByText('Asignada a (camioneta / técnico)')).toBeVisible()
})
