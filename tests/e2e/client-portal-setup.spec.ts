/**
 * E2E de activación de portal de cliente + usuarios autorizados (Fase 2 del
 * plan de cuentas/portales). Verifica: cliente nuevo sin portal → sin
 * sección Portal → marcar "tiene portal" en edición → aparece sección Portal
 * → crear usuario autorizado → password revelada una vez → login exitoso
 * con esas credenciales cae en el portal de ESE cliente.
 */
import { test, expect, type Page } from '@playwright/test'

const RUN = Date.now().toString(36)
const CLIENT_NAME = `E2E Cliente Portal ${RUN}`
const PORTAL_EMAIL = `e2e.portal.${RUN}@cliente.cl`

let clientUrl = ''
let portalSlug = ''
let generatedPassword = ''

async function loginInternal(page: Page, email: string, password: string, landing = '**/dashboard') {
  await page.goto('/login')
  await page.locator('input[name="login"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(landing, { timeout: 30000 })
}

async function loginPortal(page: Page, slug: string, email: string, password: string) {
  await page.goto(`/portal/${slug}`)
  const emailInput = page.getByPlaceholder('correo@empresa.cl')
  await emailInput.waitFor({ state: 'visible', timeout: 15000 })
  await emailInput.fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: /Ingresar/i }).click()
  await page.waitForURL(new RegExp(`/portal/${slug}/(?!$)`), { timeout: 20000 })
}

test.describe.serial('portal de cliente + usuarios autorizados', () => {
  test('1. crear cliente sin portal → sin sección Portal', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto('/recursos/clientes/new')
    await page.waitForLoadState('load')
    await page.locator('input[name="name"]').fill(CLIENT_NAME)
    await page.getByRole('button', { name: /crear cliente/i }).click()
    await page.waitForURL(/\/recursos\/clientes$/, { timeout: 20000 })

    const row = page.locator('a', { hasText: CLIENT_NAME }).first()
    await expect(row).toBeVisible({ timeout: 15000 })
    await row.click()
    await page.waitForURL(/\/recursos\/clientes\/[^/]+$/, { timeout: 15000 })
    clientUrl = new URL(page.url()).pathname

    await expect(page.getByText('Usuarios del portal')).toHaveCount(0)
  })

  test('2. activar portal en edición → aparece la sección Portal', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(clientUrl)
    await page.waitForLoadState('load')

    await page.getByText('Este cliente tendrá un portal propio').click()
    const slugInput = page.getByPlaceholder('justburger')
    await expect(slugInput).toHaveValue(/e2e-cliente-portal/, { timeout: 5000 })
    portalSlug = await slugInput.inputValue()

    await page.getByRole('button', { name: /guardar cambios/i }).click()
    await page.waitForURL(/\/recursos\/clientes$/, { timeout: 20000 })

    await page.goto(clientUrl)
    await page.waitForLoadState('load')
    await expect(page.getByText('Usuarios del portal (0)')).toBeVisible({ timeout: 10000 })
  })

  test('3. crear usuario autorizado revela password una vez', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(clientUrl)
    await page.waitForLoadState('load')

    await page.getByRole('button', { name: '+ Agregar usuario autorizado' }).click()
    await page.getByPlaceholder('Nombre *').fill('Contacto E2E')
    await page.getByPlaceholder('Email *').fill(PORTAL_EMAIL)
    await page.getByRole('button', { name: /^Crear usuario$/ }).click()

    await expect(page.getByText('Contraseña generada')).toBeVisible({ timeout: 15000 })
    generatedPassword = (await page.locator('.border-amber-300 dd.font-mono').textContent())?.trim() ?? ''
    expect(generatedPassword.length).toBeGreaterThan(0)
  })

  test('4. login exitoso con las credenciales del portal', async ({ page }) => {
    await loginPortal(page, portalSlug, PORTAL_EMAIL, generatedPassword)
    await expect(page).toHaveURL(new RegExp(`/portal/${portalSlug}/`))
  })
})
