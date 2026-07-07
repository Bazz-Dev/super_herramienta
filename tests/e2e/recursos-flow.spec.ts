import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared login helper
// ---------------------------------------------------------------------------
async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('load')
  await page.locator('input[name="login"]').fill('admin@ingegarchile.cl')
  await page.locator('input[name="password"]').fill('Ingegar@Super1')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 30000 })
  await page.waitForLoadState('load')
}

// ---------------------------------------------------------------------------
// Técnicos
// ---------------------------------------------------------------------------

test.describe('tecnicos', () => {
  test('list renders', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/tecnicos')
    await page.waitForLoadState('load')

    // h1 "Técnicos" is present
    await expect(page.getByRole('heading', { name: 'Técnicos' })).toBeVisible({ timeout: 15000 })

    // "Nuevo técnico" button (rendered as a Link) is present
    await expect(page.getByRole('link', { name: /nuevo técnico/i })).toBeVisible()
  })

  test('create and verify appears in list', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/tecnicos')
    await page.waitForLoadState('load')

    // Click "Nuevo técnico" link
    await page.getByRole('link', { name: /nuevo técnico/i }).click()
    await page.waitForURL('**/recursos/tecnicos/new', { timeout: 30000 })
    await page.waitForLoadState('load')

    // TechnicianForm uses <Field label="Nombre *"> which renders a <label> wrapping a <TextInput name="name">
    const uniqueName = `Test Auto ${Date.now()}`
    await page.locator('input[name="name"]').fill(uniqueName)

    // Fill optional specialty field to make it a complete record
    await page.locator('input[name="specialty"]').fill('E2E Testing')

    // Submit ("Crear técnico" button)
    await page.getByRole('button', { name: /crear técnico/i }).click()

    // On success, createTechnician action redirects back to /recursos/tecnicos
    await page.waitForURL('**/recursos/tecnicos', { timeout: 30000 })
    await page.waitForLoadState('load')

    // The new technician's name must appear somewhere on the list page
    await expect(page.getByText(uniqueName)).toBeVisible({ timeout: 15000 })
  })

  test('terminated technicians shown separately', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/tecnicos')
    await page.waitForLoadState('load')

    // The legend bar always shows the "Desvinculados:" label for terminated contract types.
    // This is rendered regardless of whether terminated technicians exist.
    await expect(page.getByText('Desvinculados:', { exact: false })).toBeVisible({ timeout: 15000 })

    // If terminated technicians exist, a section heading "Desvinculados (n)" appears.
    // We check for it optionally.
    const terminatedSection = page.getByText(/Desvinculados \(\d+\)/)
    const count = await terminatedSection.count()
    if (count > 0) {
      await expect(terminatedSection.first()).toBeVisible()
    }
  })
})

// ---------------------------------------------------------------------------
// Vehículos
// ---------------------------------------------------------------------------

test.describe('vehiculos', () => {
  test('list renders', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/vehiculos')
    await page.waitForLoadState('load')

    // The vehiculos page heading uses h1 — look for "Vehículos" or "Camionetas"
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 15000 })

    // "Nuevo vehículo" / "Nueva camioneta" link is present
    await expect(page.getByRole('link', { name: /(nuevo vehículo|nueva camioneta)/i })).toBeVisible()
  })

  test('create new vehicle and verify appears in list', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/vehiculos')
    await page.waitForLoadState('load')

    await page.getByRole('link', { name: /(nuevo vehículo|nueva camioneta)/i }).click()
    await page.waitForURL('**/recursos/vehiculos/new', { timeout: 30000 })
    await page.waitForLoadState('load')

    // VehicleForm: <Field label="Patente *"> → <TextInput name="plate">
    // Use a short unique value (plates are typically 7–8 chars, e.g. ABCD-12)
    const uniquePlate = `ZT${Date.now().toString().slice(-4)}`
    await page.locator('input[name="plate"]').fill(uniquePlate)

    // Status select defaults to "active" — just ensure it's present
    const statusSelect = page.locator('select[name="status"]')
    await expect(statusSelect).toBeVisible()
    await statusSelect.selectOption('active')

    // Submit ("Crear camioneta")
    await page.getByRole('button', { name: /crear camioneta/i }).click()

    // On success, createVehicle redirects back to /recursos/vehiculos
    await page.waitForURL('**/recursos/vehiculos', { timeout: 30000 })
    await page.waitForLoadState('load')

    // The plate should appear in the list
    await expect(page.getByText(uniquePlate)).toBeVisible({ timeout: 15000 })
  })

  test('expiry date fields present in new vehicle form', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/vehiculos/new')
    await page.waitForLoadState('load')

    // VehicleForm renders three expiry date inputs with these name attributes:
    //   revTecnicaExpiry, soapExpiry, permisoCirculacionExpiry
    await expect(page.locator('input[name="revTecnicaExpiry"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('input[name="soapExpiry"]')).toBeVisible()
    await expect(page.locator('input[name="permisoCirculacionExpiry"]')).toBeVisible()

    // Verify the section heading for documentation
    await expect(page.getByText(/documentos y vencimientos/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Activos
// ---------------------------------------------------------------------------

test.describe('activos', () => {
  test('list renders', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/activos')
    await page.waitForLoadState('load')

    // Page should load without a hard error — verify a heading is visible
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
    // Should not show a 404 / error page
    await expect(page.locator('h1').first()).not.toHaveText(/not found/i)
  })
})

// ---------------------------------------------------------------------------
// Cuadrillas
// ---------------------------------------------------------------------------

test.describe('cuadrillas', () => {
  test('list renders', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/cuadrillas')
    await page.waitForLoadState('load')

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
    await expect(page.locator('h1').first()).not.toHaveText(/not found/i)
  })
})

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

test.describe('clientes', () => {
  test('list renders', async ({ page }) => {
    await login(page)
    await page.goto('/recursos/clientes')
    await page.waitForLoadState('load')

    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
    await expect(page.locator('h1').first()).not.toHaveText(/not found/i)

    // Seed creates "Alcon Laboratorios Chile" client; Just Burger is loaded via
    // import:flujo — but Alcon is always present after db:seed.
    // We don't assert specific client names here to keep tests seed-agnostic.
  })
})
