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
  await expect(page.getByText('Carlos Fuentes')).toBeVisible()
})

test('can create and delete a technician', async ({ page }) => {
  await login(page)
  await page.goto('/recursos/tecnicos/new')

  const unique = `Tecnico E2E ${Date.now()}`
  await page.getByLabel('Nombre *').fill(unique)
  await page.getByLabel('Especialidad / oficio').fill('Pruebas')
  await page.getByRole('button', { name: 'Crear técnico' }).click()

  await expect(page).toHaveURL(/\/recursos\/tecnicos$/)
  const row = page.getByRole('row', { name: new RegExp(unique) })
  await expect(row).toBeVisible()

  // Clean up: delete it (accept the confirm dialog).
  page.on('dialog', (d) => d.accept())
  await row.getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByText(unique)).toHaveCount(0)
})
