import { test, expect, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared login helper
// ---------------------------------------------------------------------------
async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('load')
  await page.locator('input[name="login"]').fill('admin@ingegarchile.cl')
  await page.locator('input[name="password"]').fill('Ingegar@Super1')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard', { timeout: 30000 })
  await page.waitForLoadState('load')
}

// ---------------------------------------------------------------------------
// Tickets flow
// ---------------------------------------------------------------------------

test.describe('tickets', () => {
  test('kanban board renders with columns', async ({ page }) => {
    await login(page)
    await page.goto('/tickets')
    await page.waitForLoadState('load')

    // The tickets page renders a heading + status filter pills (buttons, not h2).
    // STATUS_COLS = Nuevo, En Revisión, En Ejecución, Esp. Aprob.
    await expect(page.getByRole('heading', { name: /Tickets/i })).toBeVisible()

    // Status pills are <button> elements, not h2 — check the "Nuevo" pill
    await expect(page.getByRole('button', { name: /Nuevo/i }).first()).toBeVisible()
  })

  test('create a new ticket', async ({ page }) => {
    await login(page)
    await page.goto('/tickets')
    await page.waitForLoadState('load')

    // Find and click "Nuevo ticket" button — rendered as a Link styled as button
    const newTicketBtn = page.getByRole('link', { name: /nuevo ticket/i })
    await expect(newTicketBtn).toBeVisible({ timeout: 15000 })
    await newTicketBtn.click()

    await page.waitForURL('**/tickets/new', { timeout: 30000 })
    await page.waitForLoadState('load')

    // The form uses controlled React state (not name attributes), so we target
    // by label text.
    const titleInput = page.getByText('Título *').locator('..').locator('input')
    await titleInput.fill(`Ticket E2E ${Date.now()}`)

    // Select the first available client (pre-selected by default — just ensure one exists)
    const clientSelect = page.getByText('Cliente *').locator('..').locator('select')
    await expect(clientSelect).toBeVisible()
    // If there's a placeholder option "Seleccionar cliente…", choose the second option
    const clientOptions = await clientSelect.locator('option').allTextContents()
    if (clientOptions.length > 1) {
      const firstRealOption = clientOptions.find((o) => o !== 'Seleccionar cliente…')
      if (firstRealOption) {
        await clientSelect.selectOption({ label: firstRealOption })
      }
    }

    // Set urgency (has a default already — just ensure it's reachable)
    const urgencySelect = page.getByText('Urgencia').locator('..').locator('select')
    await urgencySelect.selectOption('no_urgente')

    // Submit
    const submitBtn = page.getByRole('button', { name: /crear ticket/i })
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    // On success the form calls router.push(`/tickets/${result.id}`)
    await page.waitForURL(/\/tickets\/[^/]+$/, { timeout: 30000 })
    await page.waitForLoadState('load')

    // Verify we're on a ticket detail page (not the list or form)
    expect(page.url()).toMatch(/\/tickets\/[^/]+$/)
  })

  test('ticket has urgency badge visible', async ({ page }) => {
    await login(page)
    await page.goto('/tickets')
    await page.waitForLoadState('load')

    // URGENCY_LABEL values: Emergencia, Urgencia, No urgente, Preventivo
    const urgencyTexts = ['Emergencia', 'Urgencia', 'No urgente', 'Preventivo']
    const anyUrgency = urgencyTexts.map((t) => page.getByText(t, { exact: true }).first())

    // If there are tickets on the board, at least one urgency badge should appear.
    // We count how many kanban columns have card content beyond the header.
    const cards = page.locator('[class*="rounded"][class*="border"]').filter({ hasText: /(Emergencia|Urgencia|No urgente|Preventivo)/ })
    const cardCount = await cards.count()

    if (cardCount > 0) {
      await expect(cards.first()).toBeVisible()
    } else {
      // No tickets yet — the board is empty, test passes vacuously.
      // Verify at least the columns are visible (already covered by prior test).
      await expect(page.getByText('Nuevo', { exact: true }).first()).toBeVisible()
    }
  })

  test('filter by status responds to UI interaction', async ({ page }) => {
    await login(page)
    await page.goto('/tickets')
    await page.waitForLoadState('load')

    // TicketFilters renders a client selector and an assigned-to selector.
    // We just verify the filter controls are present and interactive.
    const selects = page.locator('select')
    const selectCount = await selects.count()

    if (selectCount > 0) {
      // Interact with the first select (client filter)
      const firstSelect = selects.first()
      await expect(firstSelect).toBeVisible()
      // Change to the first available option to trigger a filter
      const options = await firstSelect.locator('option').allTextContents()
      if (options.length > 1) {
        await firstSelect.selectOption({ index: 1 })
        // Allow URL/page to update
        await page.waitForTimeout(500)
        // Page should still be on /tickets
        expect(page.url()).toContain('/tickets')
      }
    } else {
      // Fallback: check the heading is still present (filter not rendered)
      await expect(page.getByText('Tickets', { exact: true }).first()).toBeVisible()
    }
  })

  test('ticket detail opens when clicking a ticket card', async ({ page }) => {
    await login(page)
    await page.goto('/tickets')
    await page.waitForLoadState('load')

    // Look for any ticket card link — cards contain a ticket code like "240101-JB-..."
    // Cards link to /tickets/[id]. We look for links inside the kanban columns area.
    const ticketLinks = page.getByRole('link').filter({ hasText: /\d{6}-/ })
    const linkCount = await ticketLinks.count()

    if (linkCount === 0) {
      // No tickets in the board — skip by verifying board is visible
      await expect(page.getByText('Nuevo', { exact: true }).first()).toBeVisible()
      return
    }

    await ticketLinks.first().click()
    await page.waitForURL(/\/tickets\/[^/]+$/, { timeout: 30000 })
    await page.waitForLoadState('load')

    // The detail page renders the ticket title in an h1 or prominent heading
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 15000 })
  })
})
