/**
 * E2E de la cadena Ticket → Trabajo → Costo → Flujo de Caja (G11 — sin cobertura
 * previa). Verifica: crear ticket → "Crear trabajo en Flujo" prefill desde el
 * ticket (originTicketId) → trabajo muestra banner "Creado desde ticket" →
 * agregar costo calcula el margen correctamente → el trabajo queda listado en
 * el detalle del ticket → intentar crear un SEGUNDO trabajo desde el mismo
 * ticket dispara el aviso de doble conteo ("ya hay N").
 *
 * Serial: los pasos comparten el ticket y el trabajo creados en los pasos 1-2.
 */
import { test, expect, type Page } from '@playwright/test'

const RUN = Date.now().toString(36)
const TICKET_TITLE = `E2E Flujo Ticket ${RUN}`
const NET_AMOUNT = 150000
const COST_AMOUNT = 30000
const MARGIN = NET_AMOUNT - COST_AMOUNT

let ticketUrl = '' // /tickets/<id>, capturado en el paso 1
let jobUrl = ''     // /flujo/trabajos/<id>, capturado en el paso 2

async function loginInternal(page: Page, email: string, password: string, landing = '**/dashboard') {
  await page.goto('/login')
  await page.locator('input[name="login"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(landing, { timeout: 30000 })
}

test.describe.serial('cadena Ticket → Trabajo → Costo → Flujo de Caja (G11)', () => {
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

  test('2. "Crear trabajo en Flujo" prefillea desde el ticket y crea el Job vinculado', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')

    await page.getByRole('link', { name: /Crear trabajo en Flujo/i }).click()
    await page.waitForURL(/\/flujo\/trabajos\/new\?/, { timeout: 15000 })

    // Banner de origen + descripción prefillada con el título del ticket
    await expect(page.getByText('Datos pre-llenados desde ticket')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[name="description"]')).toHaveValue(TICKET_TITLE)

    // Sucursal no venía en el ticket (creado sin sucursal) — seleccionar la primera disponible
    const branchSelect = page.locator('select[name="branchId"]')
    const branchOptions = await branchSelect.locator('option').all()
    expect(branchOptions.length).toBeGreaterThan(1)
    const firstReal = await branchOptions[1].getAttribute('value')
    if (firstReal) await branchSelect.selectOption(firstReal)

    await page.locator('input[name="netAmount"]').fill(String(NET_AMOUNT))
    await page.getByRole('button', { name: /Guardar trabajo/i }).click()
    // Excluir "?" del grupo: la URL de origen (.../new?cliente=...&desc=...) sin
    // el "?" en la exclusión también matchea [^/]+$ y el wait resuelve ANTES del
    // redirect real del server action, capturando la página vieja en jobUrl.
    await page.waitForURL(/\/flujo\/trabajos\/[^/?]+$/, { timeout: 20000 })
    jobUrl = new URL(page.url()).pathname

    // El trabajo quedó vinculado al ticket de origen (originTicketId)
    await expect(page.getByText('Creado desde ticket')).toBeVisible({ timeout: 10000 })
  })

  test('3. agregar un costo calcula el margen correctamente (sin doble conteo)', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(jobUrl)
    await page.waitForLoadState('load')

    await page.locator('input[name="amount"]').fill(String(COST_AMOUNT))
    await page.getByRole('button', { name: /Agregar costo/i }).click()
    const marginText = new RegExp(`Margen:\\s*\\$?${MARGIN.toLocaleString('es-CL')}`)
    await expect(page.getByText(marginText)).toBeVisible({ timeout: 15000 })
  })

  test('4. el trabajo queda listado en "Trabajos en Flujo de Caja" del ticket', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')
    await expect(page.getByText('Trabajos en Flujo de Caja')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('1 trabajo', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('5. intentar crear un segundo trabajo desde el mismo ticket muestra el aviso de doble conteo', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')
    const link = page.getByRole('link', { name: /Crear trabajo en Flujo/i })
    await expect(link).toHaveAttribute('title', /Ya hay 1 trabajo\(s\) vinculado\(s\) a este ticket/, { timeout: 10000 })
    await expect(link.getByText('⚠ ya hay 1')).toBeVisible()
  })
})
