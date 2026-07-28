/**
 * E2E del filtro Desde/Hasta en Flujo de Caja. Usa un cliente y meses
 * nuevos, fechados a futuro (año actual + 2) para quedar totalmente aislado
 * de los datos históricos del seed — así los montos se pueden comparar de
 * forma exacta, no solo "al menos".
 *
 * Reescrito el 2026-07-28: el mecanismo original de este spec (`?periodo=
 * YYYY-MM` + comparación delta "vs mes anterior") quedó obsoleto cuando
 * /flujo se unificó a un solo filtro Desde/Hasta (dateRange() reemplazó
 * periodRange()) y el panel de KPIs se rediseñó a "Control de hoy"
 * (4 indicadores de excepción que explícitamente NO dependen del período
 * seleccionado — no hay comparación vs período anterior en /flujo hoy).
 * Se preserva el fixture de datos aislados (útil y real) y se reescriben
 * las aserciones contra el filtro Desde/Hasta que sí existe.
 */
import { test, expect, type Page } from '@playwright/test'

const RUN = Date.now().toString(36)
const CLIENT_NAME = `E2E Flujo Periodo ${RUN}`
const FUTURE_YEAR = new Date().getFullYear() + 2
const MONTH_1 = `${FUTURE_YEAR}-01` // mes con trabajo — 100.000
const MONTH_2 = `${FUTURE_YEAR}-02` // mes con trabajo — 150.000
const EMPTY_MONTH = `${FUTURE_YEAR}-06` // mes sin trabajos

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
  // collectionStatus es un campo legacy derivado de financialStage (ver
  // deriveCollectionStatus) — no existe como control propio en el form.
  // "Estados y seguimiento" es una sección plegable (Cambio 3) que no está
  // abierta por defecto en un trabajo nuevo.
  await page.getByRole('button', { name: /Estados y seguimiento/i }).click()
  await page.locator('select[name="financialStage"]').selectOption({ label: 'Pendiente de pago' })
  await page.getByRole('button', { name: /guardar trabajo/i }).click()
  await page.waitForURL(/\/flujo\/trabajos\/[^/?]+$/, { timeout: 20000 })
}

function monthRange(yyyyMm: string): { desde: string; hasta: string } {
  const [y, m] = yyyyMm.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { desde: `${yyyyMm}-01`, hasta: `${yyyyMm}-${String(lastDay).padStart(2, '0')}` }
}

test.describe.serial('Flujo de Caja: filtro Desde/Hasta', () => {
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

  test('3. filtrar Desde/Hasta por un mes específico muestra exactamente ese trabajo', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    const { desde, hasta } = monthRange(MONTH_1)
    await page.goto(`/flujo?cliente=${clientId}&desde=${desde}&hasta=${hasta}`)
    await page.waitForLoadState('load')
    await expect(page.getByText('$100.000').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('$150.000')).toHaveCount(0)
  })

  test('4. mes sin trabajos no muestra los trabajos de otros meses (el filtro realmente filtra)', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    const { desde, hasta } = monthRange(EMPTY_MONTH)
    await page.goto(`/flujo?cliente=${clientId}&desde=${desde}&hasta=${hasta}`)
    await page.waitForLoadState('load')
    await expect(page.getByText('No encontramos trabajos con estos filtros')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('$100.000')).toHaveCount(0)
    await expect(page.getByText('$150.000')).toHaveCount(0)
  })

  test('5. sin filtro de fecha, ambos trabajos son visibles', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(`/flujo?cliente=${clientId}`)
    await page.waitForLoadState('load')
    await expect(page.getByText('$100.000').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('$150.000').first()).toBeVisible({ timeout: 10000 })
  })
})
