/**
 * E2E de la cadena informe → ticket → carpeta cliente (G7 — sin cobertura previa).
 * Verifica: crear ticket → "Nuevo informe técnico" autocompleta cliente desde el
 * ticket vinculado → informe queda listado en el detalle del ticket → aparece en
 * /documentos (carpeta cliente) → el cliente lo ve en su portal (/informes).
 *
 * Serial: los pasos comparten el ticket y el informe creados en los pasos 1-2.
 */
import { test, expect, type Page } from '@playwright/test'

const RUN = Date.now().toString(36)
const TICKET_TITLE = `E2E Informe Ticket ${RUN}`
const REPORT_TITLE = `E2E Informe Doc ${RUN}`

let ticketUrl = '' // /tickets/<id> interno, capturado en el paso 1

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

test.describe.serial('cadena informe → ticket → carpeta cliente (G7)', () => {
  test('1. crear ticket interno para Just Burger', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto('/tickets/new')
    await page.waitForLoadState('load')
    await page.getByText('Título *').locator('..').locator('input').fill(TICKET_TITLE)
    await page.getByText('Cliente *').locator('..').locator('select').selectOption({ label: 'Just Burger' })
    await page.getByRole('button', { name: /crear ticket/i }).click()
    await page.waitForURL(/\/tickets(\/[^/]+)?$/, { timeout: 20000 })

    await page.goto('/tickets')
    const row = page.locator('tr', { hasText: TICKET_TITLE })
    await expect(row.first()).toBeVisible({ timeout: 15000 })
    await row.first().click()
    await page.waitForURL(/\/tickets\/[^/]+$/, { timeout: 15000 })
    ticketUrl = new URL(page.url()).pathname
  })

  test('2. "Nuevo informe técnico" autocompleta cliente y guarda vinculado al ticket', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')

    await page.getByRole('link', { name: /Nuevo informe técnico/i }).click()
    await page.waitForURL(/\/informe\?ticketId=/, { timeout: 15000 })
    await page.waitForLoadState('load')

    await page.getByRole('button', { name: /Guardar en cliente/i }).click()

    // El cliente debe autocompletarse desde el ticket vinculado (G7: fix ya
    // existía en código — este test es lo que faltaba para probarlo).
    const clientSelect = page.getByText('Cliente *', { exact: true }).locator('..').locator('select')
    await expect(clientSelect).toBeVisible({ timeout: 5000 })
    const selectedLabel = await clientSelect.evaluate(
      (el: HTMLSelectElement) => el.options[el.selectedIndex]?.textContent,
    )
    expect(selectedLabel?.trim()).toBe('Just Burger')

    await page.getByText('Título del documento *', { exact: true }).locator('..').locator('input').fill(REPORT_TITLE)
    await page.getByRole('button', { name: /^Guardar$/ }).click()
    await expect(page.getByText('Guardado correctamente')).toBeVisible({ timeout: 15000 })
    await page.waitForURL(/\/informe\?docId=/, { timeout: 15000 })
  })

  test('3. el informe queda listado en el detalle del ticket', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')
    await expect(page.getByText(REPORT_TITLE).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 })
  })

  test('4. el informe aparece en /documentos dentro de la carpeta de Just Burger', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto('/documentos')
    await page.waitForLoadState('load')
    await expect(page.getByText(REPORT_TITLE).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 })
  })

  test('5. el cliente ve el informe en su portal (/informes)', async ({ page }) => {
    await loginPortal(page, 'justburger', 'portal@justburger.cl', 'JustBurger@2026')
    await page.goto('/portal/justburger/informes')
    await page.waitForLoadState('load')
    await expect(page.getByText(REPORT_TITLE).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 })
  })
})
