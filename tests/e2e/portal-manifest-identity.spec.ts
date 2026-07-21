/**
 * Regresión: cada portal debe servir SOLO su propio manifest/apple-touch-icon
 * — no el del layout raíz de INGEGAR One. Bug real encontrado en producción:
 * el layout raíz declara `manifest`/`icons.apple` vía la Metadata API de
 * Next.js, y el layout de portal renderizaba SUS PROPIOS <link> crudos en
 * JSX — ambos mecanismos no se pisan entre sí, así que quedaban DOS tags
 * `rel="manifest"` en el DOM y el navegador usa el primero en orden de
 * documento (el del layout raíz) — instalar "el portal" en realidad
 * instalaba INGEGAR One (mismo id, mismo ícono, mismo start_url=/dashboard,
 * al que el cliente ni siquiera tiene acceso). Fix: portal/[slug]/layout.tsx
 * ahora usa generateMetadata()/generateViewport() para que la Metadata API
 * de Next SÍ sobreescriba lo del layout raíz en vez de duplicarlo.
 */
import { test, expect } from '@playwright/test'

async function manifestInfo(page: import('@playwright/test').Page, url: string) {
  await page.goto(url)
  await page.waitForLoadState('load')
  return page.evaluate(async () => {
    const links = [...document.querySelectorAll('link[rel="manifest"]')].map((l) => (l as HTMLLinkElement).href)
    const manifest = links[0] ? await fetch(links[0]).then((r) => r.json()) : null
    return { linkCount: links.length, id: manifest?.id, name: manifest?.name }
  })
}

test('el portal JB sirve solo su propio manifest, distinto de INGEGAR One', async ({ page }) => {
  const jb = await manifestInfo(page, '/portal/justburger')
  expect(jb.linkCount).toBe(1)
  expect(jb.id).toBe('/portal/justburger/')
  expect(jb.name).toContain('Just Burger')
})

test('el portal Decathlon sirve solo su propio manifest, distinto de JB e INGEGAR One', async ({ page }) => {
  const dec = await manifestInfo(page, '/portal/decathlon')
  expect(dec.linkCount).toBe(1)
  expect(dec.id).toBe('/portal/decathlon/')
  expect(dec.name).toContain('Decathlon')
})

test('INGEGAR One sigue sirviendo su propio manifest sin interferencia del portal', async ({ page }) => {
  const app = await manifestInfo(page, '/login')
  expect(app.linkCount).toBe(1)
  expect(app.id).toBe('/dashboard')
  expect(app.name).toBe('INGEGAR One')
})

test('el apple-touch-icon del portal es el propio, no el genérico de INGEGAR', async ({ page }) => {
  await page.goto('/portal/justburger')
  await page.waitForLoadState('load')
  const icons = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="apple-touch-icon"]')].map((l) => (l as HTMLLinkElement).href),
  )
  expect(icons.length).toBeGreaterThan(0)
  for (const href of icons) {
    expect(href).toContain('/portal/justburger/icon/')
    expect(href).not.toContain('/ingegar-icon/')
  }
})
