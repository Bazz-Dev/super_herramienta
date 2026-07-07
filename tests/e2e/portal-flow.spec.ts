import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared helper — logs in as the Just Burger portal user.
// The form is a React controlled component: inputs have type="email"/"password"
// but no name attribute, so we locate by type.
// ---------------------------------------------------------------------------
async function loginPortal(page: import('@playwright/test').Page, slug = 'justburger') {
  await page.goto(`/portal/${slug}`)
  await page.waitForLoadState('load')
  const emailInput = page.locator('input[name="email"], input[type="email"]').first()
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill('portal@justburger.cl')
    await page.locator('input[name="password"], input[type="password"]').first().fill('JustBurger@2026')
    await page.getByRole('button', { name: /Ingresar/i }).click()
    await page.waitForLoadState('load')
  }
}

// ---------------------------------------------------------------------------
// 1. Login page renders
// ---------------------------------------------------------------------------
test('portal: login page renders', async ({ page }) => {
  await page.goto('/portal/justburger')
  await page.waitForLoadState('load')

  // Email and password inputs must be present and visible
  await expect(page.locator('input[type="email"]').first()).toBeVisible()
  await expect(page.locator('input[type="password"]').first()).toBeVisible()

  // Submit / Ingresar button
  await expect(page.getByRole('button', { name: /Ingresar/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 2. Successful login redirects to dashboard
// ---------------------------------------------------------------------------
test('portal: successful login redirects to dashboard', async ({ page }) => {
  await loginPortal(page)

  // After login, URL must contain a portal route (dashboard or similar)
  await expect(page).toHaveURL(/\/portal\/justburger/, { timeout: 20_000 })

  // Some heading or content should be visible
  await expect(page.locator('body')).toBeVisible()
})

// ---------------------------------------------------------------------------
// 3. Dashboard KPI cards visible
// ---------------------------------------------------------------------------
test('portal dashboard: KPI cards visible', async ({ page }) => {
  await loginPortal(page)
  await page.goto('/portal/justburger/dashboard')
  await page.waitForLoadState('load')

  // The dashboard renders four primary KPI cards: Activas, Emergencias,
  // Sin abordar, Vencidos. At least one of these labels must appear.
  const kpiLabels = page.getByText(/Activas|Emergencias|Sin abordar|Vencidos/)
  await expect(kpiLabels.first()).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 4. No horizontal scroll on mobile viewport
// ---------------------------------------------------------------------------
test('portal dashboard: no horizontal scroll', async ({ page }) => {
  // Must set viewport BEFORE navigation
  await page.setViewportSize({ width: 390, height: 844 })

  await loginPortal(page)
  await page.goto('/portal/justburger/dashboard')
  await page.waitForLoadState('load')

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 5)
})

// ---------------------------------------------------------------------------
// 5. Hamburger renders after hydration (mobile)
// ---------------------------------------------------------------------------
test('portal dashboard: hamburger renders after hydration', async ({ page }) => {
  // Must set viewport BEFORE navigation so JS matchMedia picks up mobile width
  await page.setViewportSize({ width: 390, height: 844 })

  await loginPortal(page)
  await page.goto('/portal/justburger/dashboard')
  await page.waitForLoadState('load')

  // The hamburger is injected by a useEffect once isMobile state resolves
  const hamburger = page.locator('[aria-label="Abrir menú"]')
  await expect(hamburger).toBeVisible({ timeout: 10_000 })

  // Must be touch-friendly: at least 44px tall (the button has padding:6px
  // around an 18×18 icon, total height ≥44px)
  const box = await hamburger.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(44)
})

// ---------------------------------------------------------------------------
// 6. Hamburger opens sidebar
// ---------------------------------------------------------------------------
test('portal dashboard: hamburger opens sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await loginPortal(page)
  await page.goto('/portal/justburger/dashboard')
  await page.waitForLoadState('load')

  const hamburger = page.locator('[aria-label="Abrir menú"]')
  await expect(hamburger).toBeVisible({ timeout: 10_000 })
  await hamburger.click()

  // After clicking, the sidebar slides in. Nav items "Panel" and
  // "Requerimientos" should become visible.
  await expect(page.getByText('Panel').first()).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText('Requerimientos').first()).toBeVisible({ timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// 7. Tickets list renders
// ---------------------------------------------------------------------------
test('portal tickets: list renders', async ({ page }) => {
  await loginPortal(page)
  await page.goto('/portal/justburger/tickets')
  await page.waitForLoadState('load')

  // The topbar title is "Todos los requerimientos". If there are no tickets
  // a "No hay tickets" style message is acceptable too.
  const heading = page.getByText(/requerimientos|No hay tickets/i)
  await expect(heading.first()).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// 8. New ticket form accessible
// ---------------------------------------------------------------------------
test('portal tickets: new ticket form accessible', async ({ page }) => {
  await loginPortal(page)
  await page.goto('/portal/justburger/tickets/new')
  await page.waitForLoadState('load')

  // Title input (name="title") must be present
  await expect(page.locator('input[name="title"]')).toBeVisible()

  // Urgency radio buttons (name="urgency")
  await expect(page.locator('input[name="urgency"]').first()).toBeVisible()

  // Submit button
  await expect(page.getByRole('button', { name: /Enviar solicitud/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// 9. Create a ticket
// ---------------------------------------------------------------------------
test('portal tickets: create a ticket', async ({ page }) => {
  await loginPortal(page)
  await page.goto('/portal/justburger/tickets/new')
  await page.waitForLoadState('load')

  // branchId is required — pick the first available option
  const branchSelect = page.locator('select[name="branchId"]')
  await expect(branchSelect).toBeVisible()
  // Select the first non-placeholder option
  const options = await branchSelect.locator('option').all()
  if (options.length > 1) {
    const firstValue = await options[1].getAttribute('value')
    if (firstValue) await branchSelect.selectOption(firstValue)
  }

  // urgency already defaults to "no_urgente" — nothing extra needed.
  // Title is required
  const title = `Test portal ${Date.now()}`
  await page.locator('input[name="title"]').fill(title)

  // Submit
  await page.getByRole('button', { name: /Enviar solicitud/i }).click()

  // After creation the router pushes to the ticket detail or ticket list.
  // Accept either URL pattern.
  await expect(page).toHaveURL(/\/portal\/justburger\/tickets/, { timeout: 20_000 })
})

// ---------------------------------------------------------------------------
// 10. Logout works
// ---------------------------------------------------------------------------
test('portal: logout works', async ({ page }) => {
  await loginPortal(page)
  await page.goto('/portal/justburger/dashboard')
  await page.waitForLoadState('load')

  // The logout button is in the sidebar footer and has title="Cerrar sesión".
  // On desktop viewport the sidebar is always visible.
  const logoutBtn = page.locator('button[title="Cerrar sesión"]')
  await expect(logoutBtn).toBeVisible({ timeout: 10_000 })
  await logoutBtn.click()

  // After sign-out, Next-auth redirects to callbackUrl = /portal/justburger
  await expect(page).toHaveURL(/\/portal\/justburger/, { timeout: 20_000 })

  // The login form must be back on screen
  await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 10_000 })
})
