/**
 * E2E del paso natural Ticket resuelto → Flujo de Caja: al marcar un ticket
 * como "resuelto" sin trabajo de cobro asociado, debe aparecer un banner
 * verde prominente ofreciendo crearlo — no solo el link chico que ya existía
 * entre las acciones secundarias. Una vez creado el trabajo, el banner
 * desaparece (y el link chico vuelve, con el aviso de "ya hay 1").
 */
import { test, expect } from '@playwright/test'

const RUN = Date.now().toString(36)
const TITLE = `E2E Ticket→Job ${RUN}`

async function loginInternal(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[name="login"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 30000 })
}

test('ticket resuelto sin trabajo → banner de "registra el cobro"; con trabajo → banner desaparece', async ({ page }) => {
  await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')

  // 1. Crear ticket
  await page.goto('/tickets/new')
  await page.waitForLoadState('load')
  await page.getByText('Título *').locator('..').locator('input').fill(TITLE)
  await page.getByText('Cliente *').locator('..').locator('select').selectOption({ label: 'Just Burger' })
  await page.getByRole('button', { name: /crear ticket/i }).click()
  await page.waitForURL(/\/tickets(\/[^/]+)?$/, { timeout: 20000 })

  await page.goto('/tickets')
  const row = page.locator('tr', { hasText: TITLE })
  await expect(row.first()).toBeVisible({ timeout: 15000 })
  await row.first().click()
  await page.waitForURL(/\/tickets\/[^/]+$/, { timeout: 15000 })
  const ticketUrl = new URL(page.url()).pathname

  // 2. Antes de resolver: link chico visible, sin banner
  await expect(page.getByRole('link', { name: /Crear trabajo en Flujo →/ })).toBeVisible()
  await expect(page.getByText('Ticket resuelto — registra el cobro')).toHaveCount(0)

  // 3. Resolver el ticket
  await page.getByPlaceholder('Describe el trabajo realizado...').fill('Trabajo completado E2E')
  await page.getByRole('button', { name: /Guardar cambios/i }).click()
  await expect(page.getByText('✓ Guardado')).toBeVisible({ timeout: 20000 })
  const statusSelect = page.getByText('Estado', { exact: true }).locator('..').locator('select')
  await statusSelect.selectOption('resuelto')

  // 4. El banner aparece de inmediato, en la misma vista
  const banner = page.getByText('Ticket resuelto — registra el cobro')
  await expect(banner).toBeVisible({ timeout: 15000 })
  const bannerCta = page.locator('a', { hasText: 'Crear trabajo en Flujo →' })
  await expect(bannerCta).toBeVisible()

  // 5. Crear el trabajo desde el banner
  await bannerCta.click()
  await page.waitForURL(/\/flujo\/trabajos\/new\?/, { timeout: 15000 })
  await expect(page.getByText('Datos pre-llenados desde ticket')).toBeVisible({ timeout: 10000 })
  const branchSelect = page.locator('select[name="branchId"]')
  const branchOptions = await branchSelect.locator('option').all()
  const firstReal = await branchOptions[1]?.getAttribute('value')
  if (firstReal) await branchSelect.selectOption(firstReal)
  await page.getByRole('button', { name: /guardar trabajo/i }).click()
  await page.waitForURL(/\/flujo\/trabajos\/[^/?]+$/, { timeout: 20000 })

  // 6. De vuelta en el ticket: el banner ya no aparece, vuelve el link chico
  //    con el aviso de doble conteo (el guard de G11 sigue intacto).
  await page.goto(ticketUrl)
  await page.waitForLoadState('load')
  await expect(page.getByText('Ticket resuelto — registra el cobro')).toHaveCount(0)
  const link = page.getByRole('link', { name: /Crear trabajo en Flujo/ })
  await expect(link).toHaveAttribute('title', /Ya hay 1 trabajo\(s\) vinculado\(s\)/, { timeout: 10000 })
})
