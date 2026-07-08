/**
 * Security & access-control E2E tests.
 *
 * Covers:
 *  1. Unauthenticated access → redirect to /login
 *  2. Role isolation — client cannot reach internal app routes
 *  3. Role isolation — tecnico can only reach /mi-panel
 *  4. Cross-client portal isolation — JustBurger user cannot view Decathlon portal
 *  5. Staff portal preview — super/supervisor can access any portal
 *  6. Portal login rejects wrong credentials
 *  7. Logout clears session (internal app)
 */
import { test, expect, type Page } from '@playwright/test'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function loginInternal(page: Page, email = 'admin@ingegarchile.cl', password = 'Ingegar@Super1') {
  await page.goto('/login')
  await page.waitForLoadState('load')
  await page.fill('input[name="login"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(/dashboard|mi-panel/, { timeout: 30_000 })
  await page.waitForLoadState('load')
}

async function loginPortal(page: Page, slug = 'justburger', email = 'portal@justburger.cl', password = 'JustBurger@2026') {
  await page.goto(`/portal/${slug}`)
  const emailInput = page.getByPlaceholder('correo@empresa.cl')
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 })
  await emailInput.fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: /Ingresar/i }).click()
  await page.waitForURL(new RegExp(`/portal/${slug}/(?!$)`), { timeout: 20_000 })
}

// ─── 1. Unauthenticated access redirects ─────────────────────────────────────

test.describe('unauthenticated redirects', () => {
  const protectedRoutes = [
    '/dashboard',
    '/tickets',
    '/recursos/tecnicos',
    '/recursos/vehiculos',
    '/cronograma',
    '/flujo',
    '/rrhh',
    '/documentos',
    '/cotizador',
  ]

  for (const route of protectedRoutes) {
    test(`${route} → redirects to /login`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    })
  }

  test('portal dashboard without session → shows login form', async ({ page }) => {
    await page.goto('/portal/justburger/dashboard')
    // canViewPortal(null, id) = false → redirects to portal login
    await expect(page).toHaveURL(/\/portal\/justburger$/, { timeout: 10_000 })
    await expect(page.getByPlaceholder('correo@empresa.cl')).toBeVisible({ timeout: 10_000 })
  })
})

// ─── 2. Client role — cannot access internal app ─────────────────────────────

test.describe('client role isolation', () => {
  test('client user is redirected away from /dashboard', async ({ page }) => {
    await loginPortal(page)

    // JustBurger client session — try to open an internal route
    await page.goto('/dashboard')

    // The auth middleware redirects 'client' away from internal routes
    // (auth.config.ts: role === 'client' → redirect to /login)
    await expect(page).not.toHaveURL(/^http:\/\/[^/]+\/dashboard$/, { timeout: 10_000 })
  })

  test('client user cannot reach /tickets (internal)', async ({ page }) => {
    await loginPortal(page)
    await page.goto('/tickets')
    await expect(page).not.toHaveURL(/^http:\/\/[^/]+\/tickets$/, { timeout: 10_000 })
  })

  test('client user cannot reach /recursos (internal)', async ({ page }) => {
    await loginPortal(page)
    await page.goto('/recursos/tecnicos')
    await expect(page).not.toHaveURL(/\/recursos\/tecnicos$/, { timeout: 10_000 })
  })
})

// ─── 3. Tecnico role — only /mi-panel ─────────────────────────────────────────

test.describe('tecnico role isolation', () => {
  test('tecnico login redirects to /mi-panel', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('load')
    await page.fill('input[name="login"]', 'jesus@ingegarchile.cl')
    await page.fill('input[name="password"]', 'Tecnico@2026')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(/\/mi-panel/, { timeout: 20_000 })
  })

  test('tecnico user is redirected from /dashboard to /mi-panel', async ({ page }) => {
    await loginInternal(page, 'jesus@ingegarchile.cl', 'Tecnico@2026')
    // After login lands on /mi-panel; try to navigate to dashboard
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/mi-panel/, { timeout: 10_000 })
  })
})

// ─── 4. Cross-client portal isolation ────────────────────────────────────────

test.describe('cross-client portal isolation', () => {
  test('JustBurger user cannot view Decathlon dashboard', async ({ page }) => {
    await loginPortal(page, 'justburger')

    // Try to access Decathlon portal — canViewPortal(jbSession, decId) = false
    await page.goto('/portal/decathlon/dashboard')

    // Should be redirected to Decathlon LOGIN page (not dashboard)
    await expect(page).toHaveURL(/\/portal\/decathlon$/, { timeout: 15_000 })

    // The Decathlon login form must be shown (the JB session is NOT valid here)
    await expect(page.getByPlaceholder('correo@empresa.cl')).toBeVisible({ timeout: 10_000 })
  })

  test('JustBurger user cannot view Decathlon tickets list', async ({ page }) => {
    await loginPortal(page, 'justburger')
    await page.goto('/portal/decathlon/tickets')
    // Redirected to Decathlon login (not the ticket list)
    await expect(page).toHaveURL(/\/portal\/decathlon$/, { timeout: 15_000 })
  })

  test('Decathlon user cannot view JustBurger dashboard', async ({ page }) => {
    await loginPortal(page, 'decathlon', 'portal@decathlon.cl', 'Decathlon@2026')
    await page.goto('/portal/justburger/dashboard')
    // Redirected to JustBurger login
    await expect(page).toHaveURL(/\/portal\/justburger$/, { timeout: 15_000 })
  })
})

// ─── 5. Staff portal preview (super can view any portal) ─────────────────────

test.describe('staff portal preview', () => {
  test('super user can view JustBurger portal as preview', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')

    // Super user navigates to the portal — canViewPortal(superSession, jbId) = true
    await page.goto('/portal/justburger/dashboard')
    await page.waitForLoadState('load')

    // Dashboard should render without redirect
    await expect(page).toHaveURL(/\/portal\/justburger\/dashboard/, { timeout: 10_000 })

    // Dashboard renders the greeting
    await expect(page.getByText(/Hola,/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('supervisor can preview portal', async ({ page }) => {
    await loginInternal(page, 'sgarrido@ingegarchile.cl', 'Ingegar@Ops1')
    await page.goto('/portal/justburger/dashboard')
    await page.waitForLoadState('load')
    await expect(page).toHaveURL(/\/portal\/justburger\/dashboard/, { timeout: 10_000 })
  })
})

// ─── 6. Portal login — wrong credentials ─────────────────────────────────────

test.describe('portal login validation', () => {
  test('wrong password shows error message, does not redirect', async ({ page }) => {
    await page.goto('/portal/justburger')
    const emailInput = page.getByPlaceholder('correo@empresa.cl')
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 })
    await emailInput.fill('portal@justburger.cl')
    await page.locator('input[type="password"]').first().fill('wrong-password-123')
    await page.getByRole('button', { name: /Ingresar/i }).click()

    // Error message appears
    await expect(page.getByText(/contraseña incorrectos|Correo o contraseña/i)).toBeVisible({ timeout: 10_000 })

    // URL has NOT changed — still on the login page
    await expect(page).toHaveURL(/\/portal\/justburger$/, { timeout: 5_000 })
  })

  test('unknown email shows error message', async ({ page }) => {
    await page.goto('/portal/justburger')
    const emailInput = page.getByPlaceholder('correo@empresa.cl')
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 })
    await emailInput.fill('nonexistent@justburger.cl')
    await page.locator('input[type="password"]').first().fill('AnyPassword@1')
    await page.getByRole('button', { name: /Ingresar/i }).click()
    await expect(page.getByText(/contraseña incorrectos|Correo o contraseña/i)).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/portal\/justburger$/, { timeout: 5_000 })
  })
})

// ─── 7. Session logout (internal) ────────────────────────────────────────────

test.describe('logout', () => {
  test('internal logout clears session and redirects to /login', async ({ page }) => {
    await loginInternal(page)

    // Find logout button in the sidebar (button text is "Salir")
    const logoutBtn = page.getByRole('button', { name: 'Salir' }).first()
    await expect(logoutBtn).toBeVisible({ timeout: 10_000 })
    await logoutBtn.click()

    // After logout, should land on /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })

    // Verify session is gone — try to access dashboard again
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})

// ─── 8. Portal: login page renders when no session ───────────────────────────

test.describe('portal login page structure', () => {
  test('login page has email input, password input, and submit button', async ({ page }) => {
    await page.goto('/portal/justburger')
    await expect(page.getByPlaceholder('correo@empresa.cl')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Ingresar/i })).toBeVisible()
  })

  test('Decathlon portal has its own branding', async ({ page }) => {
    await page.goto('/portal/decathlon')
    await expect(page.getByPlaceholder('correo@empresa.cl')).toBeVisible({ timeout: 15_000 })
    // Decathlon client name should appear on the left panel
    await expect(page.getByText(/Decathlon/i).first()).toBeVisible()
  })

  test('unknown portal slug returns 404', async ({ page }) => {
    await page.goto('/portal/non-existent-slug-xyz')
    // Next.js notFound() renders a 404 page
    // The page should NOT have the login form
    await expect(page.getByPlaceholder('correo@empresa.cl')).not.toBeVisible({ timeout: 5_000 })
  })
})
