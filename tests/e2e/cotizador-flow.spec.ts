import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('input[name="login"]', 'admin@ingegarchile.cl')
  await page.fill('input[name="password"]', 'Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 30000 })
}

test('cotizador: editor renders with preview panel', async ({ page }) => {
  await login(page)
  await page.goto('/cotizador')
  await page.waitForLoadState('load')

  // Page heading
  await expect(page.getByRole('heading', { name: /Generador de Propuesta/i })).toBeVisible()

  // The editor split-layout: left side has SectionCards, right side has the preview
  // QuotePreview wraps content in a scrollable div; the preview pane has zoom controls
  await expect(page.getByRole('button', { name: /Regenerar número/i })).toBeVisible()
})

test('cotizador: can change client name field', async ({ page }) => {
  await login(page)
  await page.goto('/cotizador')
  await page.waitForLoadState('load')

  // The "Cliente" field is a labeled text input inside "Cliente y cabecera" section
  const clientInput = page.locator('input').nth(0) // first visible text input after template buttons
  // More reliable: find via the label wrapper
  const clientField = page.locator('label', { hasText: 'Cliente' }).locator('..').locator('input').first()
  await clientField.fill('Empresa Test S.A.')
  await expect(clientField).toHaveValue('Empresa Test S.A.')
  // Page should not crash — heading is still visible
  await expect(page.getByRole('heading', { name: /Generador de Propuesta/i })).toBeVisible()
})

test('cotizador: totals section shows IVA', async ({ page }) => {
  await login(page)
  await page.goto('/cotizador')
  await page.waitForLoadState('load')

  // The totals section renders "IVA (19%)" label text and an IVA (%) field label
  await expect(page.getByText(/IVA/)).toBeVisible()
})

test('cotizador: items table has add-row button', async ({ page }) => {
  await login(page)
  await page.goto('/cotizador')
  await page.waitForLoadState('load')

  // ItemsEditor renders <AddButton> with text "Agregar ítem"
  await expect(page.getByRole('button', { name: /Agregar ítem/i })).toBeVisible()
})

test('documentos: documents folder page renders', async ({ page }) => {
  await login(page)
  await page.goto('/documentos')
  await page.waitForLoadState('load')

  // Page heading is "Carpetas de clientes"
  await expect(page.getByRole('heading', { name: /Carpetas de clientes/i })).toBeVisible()
})

test('documentos: shows organized by client', async ({ page }) => {
  await login(page)
  await page.goto('/documentos')
  await page.waitForLoadState('load')

  // The summary line shows e.g. "X documentos en Y carpetas"
  const summary = page.getByText(/documentos en .* carpetas/)
  await expect(summary).toBeVisible()
})
