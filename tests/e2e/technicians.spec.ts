import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

test('technicians list shows seeded data', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/tecnicos')
  await expect(page.getByRole('heading', { name: 'Técnicos' })).toBeVisible()
  // Seeded technician name (see prisma/seed.ts — previously "Carlos Fuentes", now "Jesús Díaz")
  await expect(page.getByText('Jesús Díaz')).toBeVisible()
})

test('can create a technician', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/tecnicos/new')

  const unique = `Tecnico E2E ${Date.now()}`
  await page.getByLabel('Nombre *').fill(unique)
  await page.getByLabel('Especialidad / oficio').fill('Pruebas')
  await page.getByRole('button', { name: 'Crear técnico' }).click()

  // On success, createTechnician redirects to the list
  await expect(page).toHaveURL(/\/recursos\/tecnicos$/, { timeout: 30000 })
  await page.waitForLoadState('load')

  // The new technician card renders the name as a link
  await expect(page.getByText(unique)).toBeVisible({ timeout: 15000 })
})
