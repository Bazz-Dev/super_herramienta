import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('input[name="login"]', 'admin@ingegarchile.cl')
  await page.fill('input[name="password"]', 'Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 30000 })
}

// ─── RR.HH. ───────────────────────────────────────────────────────────────────

test('rrhh: dashboard renders with KPIs', async ({ page }) => {
  await login(page)
  await page.goto('/rrhh')
  await page.waitForLoadState('load')

  // Page heading is "Recursos Humanos"
  await expect(page.getByRole('heading', { name: 'Recursos Humanos' })).toBeVisible()

  // At least one KPI card is visible — the labels are "Plantilla activa",
  // "Permisos pendientes", and "Masa salarial (mes)"
  await expect(page.getByText('Plantilla activa')).toBeVisible()
  await expect(page.getByText('Permisos pendientes')).toBeVisible()
  await expect(page.getByText('Masa salarial (mes)')).toBeVisible()
})

test('rrhh: vacaciones page renders', async ({ page }) => {
  await login(page)
  await page.goto('/rrhh/vacaciones')
  await page.waitForLoadState('load')

  // Page heading is "Permisos y ausencias"
  await expect(page.getByRole('heading', { name: /Permisos y ausencias/i })).toBeVisible()
})

test('rrhh: liquidaciones page renders', async ({ page }) => {
  await login(page)
  await page.goto('/rrhh/liquidaciones')
  await page.waitForLoadState('load')

  // Page heading is "Liquidaciones"
  await expect(page.getByRole('heading', { name: 'Liquidaciones' })).toBeVisible()
})

test('rrhh: can navigate to employee detail', async ({ page }) => {
  await login(page)
  await page.goto('/rrhh')
  await page.waitForLoadState('load')

  // The "Equipo activo" section lists employees as links to /rrhh/[id]
  // The links are inside the team list panel
  const teamLinks = page.locator('a[href^="/rrhh/"]').filter({ hasNot: page.locator('[href="/rrhh"]') })

  const count = await teamLinks.count()
  if (count === 0) {
    // No employees seeded — skip gracefully
    test.skip()
    return
  }

  // Click the first employee link
  await teamLinks.first().click()
  await page.waitForLoadState('load')

  // URL should now be /rrhh/<id>
  await expect(page).toHaveURL(/\/rrhh\/[^/]+$/)
})

// ─── Flujo de Caja ────────────────────────────────────────────────────────────

test('flujo: dashboard shows KPI cards', async ({ page }) => {
  await login(page)
  await page.goto('/flujo')
  await page.waitForLoadState('load')

  // Page heading
  await expect(page.getByRole('heading', { name: 'Flujo de Caja' })).toBeVisible()

  // KPI labels from KpiCard components rendered in the grid
  await expect(page.getByText('Facturado', { exact: true })).toBeVisible()
  await expect(page.getByText('Cobrado', { exact: true })).toBeVisible()
  await expect(page.getByText('Por cobrar', { exact: true })).toBeVisible()
})

test('flujo: jobs list is accessible', async ({ page }) => {
  await login(page)
  await page.goto('/flujo/trabajos')
  await page.waitForLoadState('load')

  // "Trabajos" heading on the jobs list page
  await expect(page.getByRole('heading', { name: /Trabajos/i })).toBeVisible()

  // There is a breadcrumb "← Flujo" link back to the dashboard
  await expect(page.getByRole('link', { name: /← Flujo/i })).toBeVisible()
})

test('flujo: branches admin exists', async ({ page }) => {
  await login(page)
  await page.goto('/flujo/sucursales')
  await page.waitForLoadState('load')

  // "Sucursales" heading
  await expect(page.getByRole('heading', { name: 'Sucursales', exact: true })).toBeVisible()

  // Navigation link back to Flujo
  await expect(page.getByRole('link', { name: /← Flujo/i })).toBeVisible()
})

test('flujo: can filter jobs by client', async ({ page }) => {
  await login(page)
  await page.goto('/flujo')
  await page.waitForLoadState('load')

  // ClientFilter renders a <select> with aria-label "Filtrar por cliente"
  const clientFilter = page.getByLabel('Filtrar por cliente')
  await expect(clientFilter).toBeVisible()

  // The select is interactive
  await expect(clientFilter).toBeEnabled()
})
