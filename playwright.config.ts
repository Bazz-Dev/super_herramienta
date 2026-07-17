import { defineConfig, devices } from '@playwright/test'

// E2E_PORT permite apuntar a un server ya levantado (p.ej. build de producción en 3001
// cuando Turbopack dev no hidrata — ver GAP_REGISTER G16).
const PORT = Number(process.env.E2E_PORT ?? 3000)
// 127.0.0.1 (no "localhost"): en Windows, localhost resuelve a ::1 primero y un
// wslrelay de WSL2 puede estar escuchando ahí — los tests le pegarían a otra app.
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // 🔒 Pin explícito: cualquier server que Playwright levante queda clavado a la DB
    // de test y auth local, aunque exista un .env.production.local en el directorio.
    // (Incidente G19 2026-07-16: `next start` cargó .env.production.local y los E2E
    // escribieron tickets en Turso producción.) El fallback file: nunca puede ser
    // prod; la exigencia de E2E_DATABASE_URL explícita la aplica global-setup.
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'file:./prisma/e2e.db',
      AUTH_URL: baseURL,
      AUTH_TRUST_HOST: 'true',
      PUSH_DISABLED: '1',
    },
  },
})
