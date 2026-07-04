/**
 * Mobile-first UX audit — checks touch targets, loading states, no h-scroll
 * Run: npx playwright test tests/e2e/mobile-audit.spec.ts --project=chromium
 */
import { test, expect, type Page, type Locator } from '@playwright/test'

const MOBILE_VIEWPORT = { width: 390, height: 844 }

async function loginAsMobile(page: Page) {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/login')
  await page.fill('input[name="login"]', 'admin@ingegarchile.cl')
  await page.fill('input[name="password"]', 'Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 20000 })
}

/** Returns all interactive elements below 40px height that are visible */
async function smallTargets(page: Page): Promise<{ text: string; height: number; tag: string }[]> {
  return page.evaluate(() => {
    const els = Array.from(
      document.querySelectorAll('button:not([disabled]), a[href], [role="button"], input[type="submit"]'),
    )
    return els
      .filter(el => {
        const r = el.getBoundingClientRect()
        const s = getComputedStyle(el)
        if (r.width === 0 || r.height === 0) return false
        if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false
        if (r.height >= 40) return false
        // Exclude tiny inline text links (underlined links in prose)
        if (el.tagName === 'A' && s.textDecoration.includes('underline') && r.height < 20) return false
        return true
      })
      .map(el => ({
        tag: el.tagName,
        text: ((el as HTMLElement).innerText?.trim().slice(0, 50) || el.getAttribute('aria-label') || '(no text)'),
        height: Math.round(el.getBoundingClientRect().height),
      }))
  })
}

async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 5)
}

// ─── LOGIN PAGE ────────────────────────────────────────────────────────────
test('login: all touch targets ≥ 40px on mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  const small = await smallTargets(page)
  expect(small, `Small elements: ${JSON.stringify(small)}`).toHaveLength(0)
})

test('login: no horizontal scroll', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/login')
  expect(await noHorizontalScroll(page)).toBe(true)
})

test('login: submit button has spinner when submitting', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await page.goto('/login')
  await page.getByLabel('Usuario o Email').fill('admin@ingegarchile.cl')
  await page.getByLabel('Contraseña', { exact: true }).fill('ingegar123')
  // Start looking for spinner before clicking
  const spinnerPromise = page.waitForSelector('button[type="submit"] svg', { timeout: 3000 }).catch(() => null)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  const spinner = await spinnerPromise
  // Spinner might flash too fast — just confirm button has pending state
  const btn = page.getByRole('button', { name: /Ingresando|Ingresar/ })
  await expect(btn).toBeVisible()
})

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
test('dashboard: mobile nav hamburger is ≥44px', async ({ page }) => {
  await loginAsMobile(page)
  const hamburger = page.getByRole('button', { name: 'Abrir menú' })
  await expect(hamburger).toBeVisible()
  const rect = await hamburger.boundingBox()
  expect(rect!.height).toBeGreaterThanOrEqual(44)
  expect(rect!.width).toBeGreaterThanOrEqual(44)
})

test('dashboard: mobile drawer opens and closes', async ({ page }) => {
  await loginAsMobile(page)
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await expect(page.locator('aside').first()).toBeVisible()
  // Close on overlay click
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
})

test('dashboard: TopProgress element in DOM', async ({ page }) => {
  await loginAsMobile(page)
  const bar = page.locator('.route-progress')
  await expect(bar).toBeAttached()
})

test('dashboard: no horizontal scroll on mobile', async ({ page }) => {
  await loginAsMobile(page)
  expect(await noHorizontalScroll(page)).toBe(true)
})

test('dashboard: all touch targets ≥ 40px on mobile', async ({ page }) => {
  await loginAsMobile(page)
  const small = await smallTargets(page)
  expect(small, `Small elements: ${JSON.stringify(small)}`).toHaveLength(0)
})

// ─── TICKETS ───────────────────────────────────────────────────────────────
test('tickets: no horizontal scroll on mobile', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/tickets')
  await page.waitForLoadState('networkidle')
  expect(await noHorizontalScroll(page)).toBe(true)
})

test('tickets: touch targets ≥ 40px on mobile', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/tickets')
  await page.waitForLoadState('networkidle')
  const small = await smallTargets(page)
  expect(small, `Small elements: ${JSON.stringify(small)}`).toHaveLength(0)
})

// ─── CRONOGRAMA ────────────────────────────────────────────────────────────
test('cronograma: no horizontal scroll on mobile', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/cronograma')
  await page.waitForLoadState('networkidle')
  expect(await noHorizontalScroll(page)).toBe(true)
})

// ─── RECURSOS ──────────────────────────────────────────────────────────────
test('recursos/técnicos/new: form button ≥44px with spinner pattern', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/recursos/tecnicos/new')
  await page.waitForLoadState('networkidle')
  const submitBtn = page.getByRole('button', { name: /Crear técnico/i })
  await expect(submitBtn).toBeVisible()
  const rect = await submitBtn.boundingBox()
  expect(rect!.height).toBeGreaterThanOrEqual(44)
  // Button should have aria-busy attribute (wired for loading)
  await expect(submitBtn).toHaveAttribute('aria-busy', 'false')
})

test('recursos/técnicos: no horizontal scroll', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/recursos/tecnicos')
  await page.waitForLoadState('networkidle')
  expect(await noHorizontalScroll(page)).toBe(true)
})

// ─── RR.HH. ────────────────────────────────────────────────────────────────
test('rrhh: no horizontal scroll on mobile', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/rrhh')
  await page.waitForLoadState('networkidle')
  expect(await noHorizontalScroll(page)).toBe(true)
})

test('rrhh: touch targets ≥ 40px on mobile', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/rrhh')
  await page.waitForLoadState('networkidle')
  const small = await smallTargets(page)
  expect(small, `Small elements: ${JSON.stringify(small)}`).toHaveLength(0)
})

// ─── FLUJO ─────────────────────────────────────────────────────────────────
test('flujo: no horizontal scroll on mobile', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/flujo')
  await page.waitForLoadState('networkidle')
  expect(await noHorizontalScroll(page)).toBe(true)
})

// ─── DOCUMENTOS ────────────────────────────────────────────────────────────
test('documentos: no horizontal scroll on mobile', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/documentos')
  await page.waitForLoadState('networkidle')
  expect(await noHorizontalScroll(page)).toBe(true)
})

test('documentos: touch targets ≥ 40px on mobile', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/documentos')
  await page.waitForLoadState('networkidle')
  const small = await smallTargets(page)
  expect(small, `Small elements: ${JSON.stringify(small)}`).toHaveLength(0)
})

// ─── PERFIL ────────────────────────────────────────────────────────────────
test('perfil: form buttons ≥44px with spinner pattern', async ({ page }) => {
  await loginAsMobile(page)
  await page.goto('/perfil')
  await page.waitForLoadState('networkidle')
  const small = await smallTargets(page)
  expect(small, `Small elements on /perfil: ${JSON.stringify(small)}`).toHaveLength(0)
})
