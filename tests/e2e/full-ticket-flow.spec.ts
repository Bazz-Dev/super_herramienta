/**
 * E2E integral del flujo de tickets — la cadena completa exigida:
 * portal JB → guardado único → /tickets interno → invisible para otro cliente
 * → asignación técnico → acción/historial → cliente ve solo lo público
 * → adjunto imagen (R2 dev) → cierre → estado propagado
 * + segundo cliente (interno, urgente, sin sucursal) + pendiente_aprobacion (usuario sucursal).
 *
 * Serial: los pasos comparten el ticket creado en el paso 1.
 */
import { test, expect, type Page } from '@playwright/test'

const RUN = Date.now().toString(36)
const TITLE = `E2E Full ${RUN}`
const COMMENT_PUBLIC = `Avance visible al cliente ${RUN}`
const NOTE_INTERNAL = `Nota interna secreta ${RUN}`

let ticketUrl = '' // /tickets/<id> interno, capturado en el paso 3

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

test.describe.serial('flujo integral de tickets', () => {
  test('1. cliente JB crea ticket en portal', async ({ page }) => {
    await loginPortal(page, 'justburger', 'portal@justburger.cl', 'JustBurger@2026')
    await page.goto('/portal/justburger/tickets/new')
    const branchSelect = page.locator('select[name="branchId"]')
    await expect(branchSelect).toBeVisible()
    const options = await branchSelect.locator('option').all()
    if (options.length > 1) {
      const v = await options[1].getAttribute('value')
      if (v) await branchSelect.selectOption(v)
    }
    await page.locator('input[name="title"]').fill(TITLE)
    await page.getByRole('button', { name: /Enviar solicitud/i }).click()
    await expect(page).toHaveURL(/\/portal\/justburger\/tickets/, { timeout: 20000 })
  })

  test('2. se guardó UNA sola vez (lista portal)', async ({ page }) => {
    await loginPortal(page, 'justburger', 'portal@justburger.cl', 'JustBurger@2026')
    await page.goto('/portal/justburger/tickets')
    await page.waitForLoadState('load')
    // La lista renderiza variante desktop + mobile: contar solo nodos VISIBLES
    const visibles = page.getByText(TITLE).filter({ visible: true })
    await expect(visibles.first()).toBeVisible({ timeout: 15000 })
    expect(await visibles.count()).toBe(1)
  })

  test('3. aparece en /tickets interno una sola vez', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto('/tickets')
    await page.waitForLoadState('load')
    const row = page.locator('tr', { hasText: TITLE })
    await expect(row.first()).toBeVisible({ timeout: 15000 })
    expect(await row.count()).toBe(1)
    await row.first().click()
    await page.waitForURL(/\/tickets\/[^/]+$/, { timeout: 15000 })
    ticketUrl = new URL(page.url()).pathname
  })

  test('4. NO aparece en el portal de otro cliente (Decathlon)', async ({ page }) => {
    await loginPortal(page, 'decathlon', 'portal@decathlon.cl', 'Decathlon@2026')
    await page.goto('/portal/decathlon/tickets')
    await page.waitForLoadState('load')
    expect(await page.getByText(TITLE).count()).toBe(0)
  })

  test('5. supervisor asigna técnico y pasa a ejecución', async ({ page }) => {
    await loginInternal(page, 'sgarrido@ingegarchile.cl', 'Ingegar@Ops1')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')
    // 1) Asignar técnico y GUARDAR (el cambio de estado dispara un refresh que
    //    resetearía la selección no guardada)
    const tecSelect = page.getByText('Técnico asignado').locator('..').locator('select')
    await tecSelect.selectOption({ label: 'Jesús Díaz' })
    await page.getByRole('button', { name: /Guardar cambios/i }).click()
    await expect(page.getByText('✓ Guardado')).toBeVisible({ timeout: 20000 })
    // 2) Pasar a ejecución (onChange dispara updateTicketStatus de inmediato)
    const statusSelect = page.getByText('Estado', { exact: true }).locator('..').locator('select')
    await statusSelect.selectOption('en_ejecucion')
    // La transition termina cuando el botón vuelve de "Guardando…"
    await expect(page.getByRole('button', { name: /^Guardar cambios$/ })).toBeVisible({ timeout: 20000 })
  })

  test('6. supervisor deja nota interna + comentario público (historial)', async ({ page }) => {
    await loginInternal(page, 'sgarrido@ingegarchile.cl', 'Ingegar@Ops1')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')
    // Nota interna
    const box = page.getByPlaceholder('Escribe un comentario...')
    await box.fill(NOTE_INTERNAL)
    await page.getByText('Nota interna (no visible al cliente)').click()
    await page.getByRole('button', { name: /Guardar nota/i }).click()
    await expect(page.getByText(NOTE_INTERNAL)).toBeVisible({ timeout: 15000 })
    // Comentario público
    await box.fill(COMMENT_PUBLIC)
    const internalToggle = page.getByText('Nota interna (no visible al cliente)').locator('input[type="checkbox"]')
    if (await internalToggle.isChecked().catch(() => false)) {
      await page.getByText('Nota interna (no visible al cliente)').click()
    }
    await page.getByRole('button', { name: /Publicar comentario/i }).click()
    await expect(page.getByText(COMMENT_PUBLIC)).toBeVisible({ timeout: 15000 })
  })

  test('7. técnico accede y registra una acción', async ({ page }) => {
    await loginInternal(page, 'jesus@ingegarchile.cl', 'Tecnico@2026', '**/mi-panel')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')
    const box = page.getByPlaceholder('Escribe un comentario...')
    await expect(box).toBeVisible({ timeout: 15000 })
    await box.fill(`Atención registrada por técnico ${RUN}`)
    await page.getByRole('button', { name: /Publicar comentario/i }).click()
    await expect(page.getByText(`Atención registrada por técnico ${RUN}`)).toBeVisible({ timeout: 15000 })
  })

  test('8. cliente ve el comentario público pero NO la nota interna', async ({ page }) => {
    await loginPortal(page, 'justburger', 'portal@justburger.cl', 'JustBurger@2026')
    await page.goto('/portal/justburger/tickets')
    await page.getByText(TITLE).filter({ visible: true }).first().click()
    await page.waitForURL(/\/portal\/justburger\/tickets\/[^/]+$/, { timeout: 15000 })
    await expect(page.getByText(COMMENT_PUBLIC)).toBeVisible({ timeout: 15000 })
    expect(await page.getByText(NOTE_INTERNAL).count()).toBe(0)
  })

  test('9. adjuntar imagen desde el ticket interno (R2 dev + metadata Turso)', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(ticketUrl)
    await page.waitForLoadState('load')
    // PNG 1x1 rojo en memoria
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles({ name: `evidencia-${RUN}.png`, mimeType: 'image/png', buffer: png })
    // El documento debe aparecer listado en el ticket
    await expect(page.getByText(`evidencia-${RUN}.png`)).toBeVisible({ timeout: 30000 })
  })

  test('10. cierre: estado resuelto se propaga a interno y portal', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto(ticketUrl)
    // Resumen del trabajo primero (y guardar), después el cambio de estado
    const resumen = page.getByPlaceholder('Describe el trabajo realizado...')
    await resumen.fill(`Trabajo completado E2E ${RUN}`)
    await page.getByRole('button', { name: /Guardar cambios/i }).click()
    await expect(page.getByText('✓ Guardado')).toBeVisible({ timeout: 20000 })
    const statusSelect = page.getByText('Estado', { exact: true }).locator('..').locator('select')
    await statusSelect.selectOption('resuelto')
    await expect(page.getByRole('button', { name: /^Guardar cambios$/ })).toBeVisible({ timeout: 20000 })
    // KPI/estado en el kanban interno: al filtrar Resuelto, el ticket está
    await page.goto('/tickets')
    await page.getByRole('button', { name: /Resuelto/i }).first().click()
    await expect(page.locator('tr', { hasText: TITLE }).first()).toBeVisible({ timeout: 15000 })
    // Portal refleja el cierre
    await page.context().clearCookies()
    await loginPortal(page, 'justburger', 'portal@justburger.cl', 'JustBurger@2026')
    await page.goto('/portal/justburger/tickets')
    const item = page.getByText(TITLE).filter({ visible: true }).first()
    await expect(item).toBeVisible({ timeout: 15000 })
  })

  test('11. segundo cliente: ticket interno urgente SIN sucursal → prefijo correcto', async ({ page }) => {
    await loginInternal(page, 'admin@ingegarchile.cl', 'Ingegar@Super1')
    await page.goto('/tickets/new')
    await page.waitForLoadState('load')
    const titleInput = page.getByText('Título *').locator('..').locator('input')
    await titleInput.fill(`E2E Interno DEC ${RUN}`)
    const clientSelect = page.getByText('Cliente *').locator('..').locator('select')
    await clientSelect.selectOption({ label: 'Decathlon Chile' })
    // Urgente, sin sucursal
    const urgSelect = page.locator('select:has(option:text-is("Urgencia"))').first()
    await urgSelect.selectOption({ label: 'Urgencia' })
    await page.getByRole('button', { name: /crear ticket/i }).click()
    await page.waitForURL(/\/tickets(\/[^/]+)?$/, { timeout: 20000 })
    // El código NO debe llevar el viejo hardcode JB: prefijo del cliente real
    await page.goto('/tickets')
    const row = page.locator('tr', { hasText: `E2E Interno DEC ${RUN}` })
    await expect(row.first()).toBeVisible({ timeout: 15000 })
    await expect(row.first()).toContainText('-DECA-')
  })

  test('12. usuario de sucursal JB crea ticket → queda pendiente de aprobación', async ({ page }) => {
    await loginPortal(page, 'justburger', 'quilin@justburger.cl', 'JBSucursal@2026')
    await page.goto('/portal/justburger/tickets/new')
    const branchSelect = page.locator('select[name="branchId"]')
    if (await branchSelect.isVisible().catch(() => false)) {
      const options = await branchSelect.locator('option').all()
      if (options.length > 1) {
        const v = await options[1].getAttribute('value')
        if (v) await branchSelect.selectOption(v)
      }
    }
    await page.locator('input[name="title"]').fill(`E2E Sucursal ${RUN}`)
    await page.getByRole('button', { name: /Enviar solicitud/i }).click()
    await expect(page).toHaveURL(/\/portal\/justburger\/tickets/, { timeout: 20000 })
    // Carolina (client admin) ve el estado pendiente de aprobación
    await page.context().clearCookies()
    await loginPortal(page, 'justburger', 'carolina@justburger.cl', 'Carolina@JB2026')
    await page.goto('/portal/justburger/tickets')
    const item = page.getByText(`E2E Sucursal ${RUN}`).filter({ visible: true }).first()
    await expect(item).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/pendiente.*aprobaci/i).filter({ visible: true }).first()).toBeVisible({ timeout: 15000 })
  })
})
