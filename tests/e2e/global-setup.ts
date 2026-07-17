/**
 * Playwright globalSetup — corre una vez antes de toda la suite.
 *
 * Blindaje G19: los E2E exigen E2E_DATABASE_URL explícita y local, verifican que
 * un server externo (E2E_PORT) no tenga auth de producción, e imprimen el entorno
 * efectivo. Cualquier condición insegura ABORTA la suite antes del primer test.
 */
import { execSync } from 'child_process'
import { assertSafeE2EDatabaseUrl, assertSafeE2EBaseUrl, assertExternalServerSafe } from './env-guard'

export default async function globalSetup() {
  const dbUrl = assertSafeE2EDatabaseUrl(process.env.E2E_DATABASE_URL)
  const port = Number(process.env.E2E_PORT ?? 3000)
  const baseURL = `http://127.0.0.1:${port}`
  assertSafeE2EBaseUrl(baseURL)

  console.log('\n  [E2E] baseURL :', baseURL, process.env.E2E_PORT ? '(server externo)' : '(webServer de Playwright)')
  console.log('  [E2E] DB      :', dbUrl, '→ SQLite local exclusiva de test')
  console.log('  [E2E] push    : deshabilitado (PUSH_DISABLED=1 en webServer)')

  if (process.env.E2E_PORT) {
    await assertExternalServerSafe(baseURL)
    console.log('  [E2E] server externo verificado: auth NO apunta a producción')
  }

  // Migraciones + seed SIEMPRE contra la DB de test (nunca la ambient DATABASE_URL)
  const env = { ...process.env, DATABASE_URL: dbUrl }
  execSync('npx prisma migrate deploy', { stdio: 'pipe', timeout: 60_000, env })
  execSync('npm run db:seed', { stdio: 'pipe', timeout: 120_000, env })
  console.log('  [E2E] ✅ Migraciones + seed aplicados a la DB de test\n')
}
