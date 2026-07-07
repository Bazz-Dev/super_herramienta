import { test, expect } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('input[name="login"]', 'admin@ingegarchile.cl')
  await page.fill('input[name="password"]', 'Ingegar@Super1')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 30000 })
}

test('cronograma: renders calendar view', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma')
  await page.waitForLoadState('load')

  // Page heading
  await expect(page.getByRole('heading', { name: 'Cronograma' })).toBeVisible()
})

test('cronograma: has view toggle buttons', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma')
  await page.waitForLoadState('load')

  // The page renders view toggle links: "Calendario", "Por técnico", "Carga laboral"
  await expect(page.getByRole('link', { name: 'Calendario' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Por técnico' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Carga laboral' })).toBeVisible()
})

test('cronograma: can switch views', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma')
  await page.waitForLoadState('load')

  // Click "Por técnico" view
  await page.getByRole('link', { name: 'Por técnico' }).click()
  await page.waitForLoadState('load')

  // URL should now have vista=tecnico
  await expect(page).toHaveURL(/vista=tecnico/)

  // The "Por técnico" swimlane renders a week navigation with "Anterior" / "Siguiente"
  await expect(page.getByRole('link', { name: 'Anterior' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Siguiente' })).toBeVisible()
})

test('cronograma: technician filter exists', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma?vista=tecnico')
  await page.waitForLoadState('load')

  // The "Por técnico" view renders a table with a "Técnico" column header
  await expect(page.getByRole('columnheader', { name: 'Técnico' })).toBeVisible()
})

test('cronograma: new assignment button exists', async ({ page }) => {
  await login(page)
  await page.goto('/cronograma')
  await page.waitForLoadState('load')

  // There is a "Nueva asignación" link in the page header
  const newBtn = page.getByRole('link', { name: /Nueva asignación/i })
  await expect(newBtn).toBeVisible()

  // Verify it points to the new-assignment page
  const href = await newBtn.getAttribute('href')
  expect(href).toContain('/cronograma/new')
})
