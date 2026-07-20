/**
 * E2E del filtro de mes/año específico + delta vs período anterior en Flujo
 * de Caja (Fase 3 del plan de cuentas/portales/KPIs). Usa un cliente y
 * meses nuevos, fechados a futuro (año actual + 2) para quedar totalmente
 * aislado de los datos históricos del seed — así los montos se pueden
 * comparar de forma exacta, no solo "al menos".
 */
import { test, expect, type Page } from '@playwright/test'

const RUN = Date.now().toString(36)
const CLIENT_NAME = `E2E Flujo Periodo ${RUN}`
const FUTURE_YEAR = new Date().getFullYear() + 2
const MONTH_1 = `${FUTURE_YEAR}-01` // período "anterior" — 100.000
const MONTH_2 = `${FUTURE_YEAR}-02` // período "actual" — 150.000 (+50%)

let clientId = ''

async function loginInternal(page: Page, email: string, password: string, landing = '**/dashboard') {
  await page.goto('/login')
  await page.locator('input[name="login"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(landing, { timeout: 30000 })
}

async function createJob(page: Page, executionDate: string, netAmount: number) {
  await page.goto(`/flujo/trabajos/new?cliente=${clientId}`)
  await page.waitForLoadState('load')
  await page.locator('select[name="branchId"]').selectOption({ label: 'Sucursal E2E' })
  await page.locator('input[name="description"]').fill(`Trabajo ${executionDate}`)
  await page.locator('input[name="executionDate"]').fill(executionDate)
  await page.locator('input[name="netAmount"]').fill(String(netAmount))
  // Default es 'sin_oc' (va a "Sin facturar", no a "Facturado") — necesitamos
  // que cuente como facturado para probar el delta de Facturado/Cobrado.
  await page.locator('select[name="collectionStatus"]').selectOption({ label: 'Pendiente pago' })
  await page.getByRole('button', { name: /guardar trabajo/i }).click()
  await page.waitForURL(/\/flujo\/trabajos\/[^/?]+$/, { timeout: 20000 })
}

test.describe.serial('Flujo de Caja: filtro de mes/año + delta', () => {
  test('1. crear cliente + sucursal aislados para este test', async ({ page }) => {
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
    clientId = new URL(page.url()).pathname.split('/').pop()!

    await page.goto(`/flujo/sucursales?cliente=${clientId}`)
    await page.waitForLoadState('load')
    await page.locator('input[name="name"]').fill('Sucursal E2E')
    await page.getByRole('button', { name: /guardar sucursal/i }).click()
    await expect(page.getByText('Sucursal E2E')).toBeVisible({ timeout: 15000 })
  })

  test('2. crear 2 trabajos en meses futuros consecutivos aislados', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await createJob(page, `${MONTH_1}-15`, 100000)
    await createJob(page, `${MONTH_2}-15`, 150000)
  })

  test('3. filtrar por mes específico muestra exactamente ese trabajo', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(`/flujo?cliente=${clientId}&periodo=${MONTH_1}`)
    await page.waitForLoadState('load')
    await expect(page.getByText('$100.000').first()).toBeVisible({ timeout: 10000 })
  })

  test('4. mes sin trabajos muestra $0 (el filtro realmente filtra)', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(`/flujo?cliente=${clientId}&periodo=${FUTURE_YEAR}-06`)
    await page.waitForLoadState('load')
    await expect(page.getByText('Facturado', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('$100.000')).toHaveCount(0)
    await expect(page.getByText('$150.000')).toHaveCount(0)
  })

  test('5. mes 2 muestra delta +50% vs mes anterior', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(`/flujo?cliente=${clientId}&periodo=${MONTH_2}`)
    await page.waitForLoadState('load')
    await expect(page.getByText('$150.000').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/▲ 50% vs mes anterior/)).toBeVisible({ timeout: 10000 })
  })
})
