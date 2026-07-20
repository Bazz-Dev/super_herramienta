/**
 * E2E de creación de cuentas de técnico desde el admin (Fase 1 del plan de
 * cuentas/portales). Verifica: super crea un técnico sin cuenta → tab Acceso
 * muestra el form → crear cuenta revela la password una sola vez → login
 * exitoso con esas credenciales → supervisor NO ve botones de gestión de
 * credenciales (solo super puede emitir/resetear).
 */
import { test, expect, type Page } from '@playwright/test'

const RUN = Date.now().toString(36)
const TECH_NAME = `E2E Tecnico ${RUN}`
const ACCOUNT_EMAIL = `e2e.tecnico.${RUN}@ingegarchile.cl`

let techUrl = ''
let generatedPassword = ''

async function loginInternal(page: Page, email: string, password: string, landing = '**/dashboard') {
  await page.goto('/login')
  await page.locator('input[name="login"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(landing, { timeout: 30000 })
}

test.describe.serial('cuentas de técnico desde el admin', () => {
  test('1. crear técnico sin cuenta de acceso', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto('/recursos/tecnicos/new')
    await page.waitForLoadState('load')
    await page.locator('input[name="name"]').fill(TECH_NAME)
    await page.getByRole('button', { name: /crear técnico/i }).click()
    await page.waitForURL(/\/recursos\/tecnicos$/, { timeout: 20000 })

    const row = page.locator('a', { hasText: TECH_NAME }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.click()
    await page.waitForURL(/\/recursos\/tecnicos\/[^/]+$/, { timeout: 15000 })
    techUrl = new URL(page.url()).pathname
  })

  test('2. tab Acceso muestra el form de creación y revela la password una vez', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(techUrl)
    await page.waitForLoadState('load')

    await page.getByRole('button', { name: 'Acceso' }).click()
    await expect(page.getByText('todavía no tiene cuenta')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Email *').fill(ACCOUNT_EMAIL)
    await page.getByRole('button', { name: /crear cuenta/i }).click()

    await expect(page.getByText('Contraseña generada')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(ACCOUNT_EMAIL)).toBeVisible()

    generatedPassword = (await page.locator('.border-amber-300 dd.font-mono').textContent())?.trim() ?? ''
    expect(generatedPassword.length).toBeGreaterThan(0)
  })

  test('3. login exitoso con las credenciales generadas → cae en /mi-panel', async ({ page }) => {
    await loginInternal(page, ACCOUNT_EMAIL, generatedPassword, '**/mi-panel')
    await expect(page.getByText(TECH_NAME).first()).toBeVisible({ timeout: 10000 })
  })

  test('4. supervisor NO ve botones de resetear/desactivar (solo super gestiona credenciales)', async ({ page }) => {
    await loginInternal(page, 'sgarrido@ingegarchile.cl', 'Ingegar@Ops1')
    await page.goto(techUrl)
    await page.waitForLoadState('load')
    await page.getByRole('button', { name: 'Acceso' }).click()

    await expect(page.getByText(ACCOUNT_EMAIL)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /resetear contraseña/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /desactivar cuenta/i })).toHaveCount(0)
    await expect(page.getByText('Solo el admin puede resetear')).toBeVisible()
  })
})
