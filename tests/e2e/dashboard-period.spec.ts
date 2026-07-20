/**
 * E2E del "Resumen del período" en el Dashboard (Fase 4 del plan de
 * cuentas/portales/KPIs). La aritmética del delta/período ya se prueba a
 * fondo en flujo-period-filter.spec.ts (misma lib compartida
 * src/lib/cashflow/period.ts) — acá solo se cubre lo nuevo de esta
 * superficie: que la sección exista, que el PeriodFilter apunte a
 * /dashboard (no a /flujo, que es basePath por defecto del componente), y
 * que "Todo" muestre el estado sin comparación.
 */
import { test, expect } from '@playwright/test'

async function loginInternal(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[name="login"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 30000 })
}

test('Resumen del período aparece con Facturado, Tickets resueltos y carga por técnico', async ({ page }) => {
  await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
  await expect(page.getByText('Resumen del período')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Facturado', { exact: true })).toBeVisible()
  await expect(page.getByText('Tickets resueltos')).toBeVisible()
  await expect(page.getByText('Tickets activos por técnico')).toBeVisible()
})

test('el filtro de período del dashboard queda en /dashboard, no en /flujo', async ({ page }) => {
  await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
  await page.getByRole('button', { name: 'Todo' }).click()
  await expect(page).toHaveURL(/\/dashboard\?periodo=total/, { timeout: 15000 })
  await expect(page.getByText(/Elige un período específico/)).toBeVisible({ timeout: 10000 })
})

test('elegir año/mes específico actualiza la URL bajo /dashboard', async ({ page }) => {
  await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
  // El selector de año va de currentYear a currentYear-4 (sin años futuros).
  const year = new Date().getFullYear()
  await page.selectOption('select[aria-label="Año específico"]', String(year))
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?periodo=${year}`), { timeout: 15000 })
  await page.selectOption('select[aria-label="Mes específico"]', '03')
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?periodo=${year}-03`), { timeout: 15000 })
  await expect(page.getByText('Resumen del período')).toBeVisible()
})
