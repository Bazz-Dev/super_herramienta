import { test, expect } from '@playwright/test'

test('unauthenticated user is redirected to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Herramienta interna de gestión')).toBeVisible()
})

test('super user can log in and reach the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="login"]', 'admin@ingegarchile.cl')
  await page.fill('input[name="password"]', 'Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Dashboard shows tenant-scoped or all-tenant content for super role
  await expect(page.locator('main')).toBeVisible()
})

test('invalid credentials show an error', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="login"]', 'admin@ingegarchile.cl')
  await page.fill('input[name="password"]', 'wrong-password')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page.getByText('Usuario o contraseña incorrectos.')).toBeVisible()
})
