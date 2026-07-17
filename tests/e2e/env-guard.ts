/**
 * Guards fail-fast para que los E2E JAMÁS toquen producción (incidente G19).
 * Funciones puras — testeadas en tests/unit/e2e-guard.test.ts.
 */
const REMOTE_DB = /^(libsql|https?|wss?):\/\//i
const PROD_HOSTS = /vercel\.app|turso\.io|super-herramienta/i

/** E2E exige E2E_DATABASE_URL explícita y local — sin fallback a DATABASE_URL. */
export function assertSafeE2EDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error(
      'E2E requiere E2E_DATABASE_URL explícita (recomendado: file:./prisma/e2e.db).\n' +
      'Sin fallback a DATABASE_URL para no heredar producción por accidente.\n' +
      'Ej: E2E_DATABASE_URL=file:./prisma/e2e.db npm run test:e2e',
    )
  }
  if (REMOTE_DB.test(url) || PROD_HOSTS.test(url)) {
    throw new Error(`E2E_DATABASE_URL apunta a una base remota/producción — prohibido en tests: ${url.split('@')[0].slice(0, 40)}…`)
  }
  if (!url.startsWith('file:')) {
    throw new Error(`E2E_DATABASE_URL debe ser file: local (recibido: ${url.slice(0, 16)}…)`)
  }
  return url
}

/** El baseURL de E2E debe ser loopback local, nunca un dominio productivo. */
export function assertSafeE2EBaseUrl(baseURL: string): void {
  if (PROD_HOSTS.test(baseURL)) throw new Error(`baseURL de E2E apunta a producción (${baseURL}) — prohibido.`)
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(baseURL)) {
    throw new Error(`baseURL de E2E debe ser 127.0.0.1/localhost (recibido: ${baseURL})`)
  }
}

/**
 * Sonda para servers externos (E2E_PORT): si el server cargó .env.production.local,
 * su AUTH_URL apunta a Vercel y todo redirect de auth lo delata. Se envía un POST
 * de credenciales basura (nunca válido) y se inspecciona el Location.
 */
export async function assertExternalServerSafe(baseURL: string): Promise<void> {
  const res = await fetch(`${baseURL}/api/auth/callback/credentials`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ login: '__e2e_guard__', password: 'x' }),
  })
  const loc = res.headers.get('location') ?? ''
  if (PROD_HOSTS.test(loc)) {
    throw new Error(
      `El server en ${baseURL} tiene AUTH_URL de PRODUCCIÓN (redirect: ${loc}).\n` +
      'Probablemente cargó .env.production.local. Relánzalo con env pineado:\n' +
      '  DATABASE_URL="file:./prisma/e2e.db" AUTH_URL="' + baseURL + '" AUTH_TRUST_HOST=true PUSH_DISABLED=1 npx next start -p <puerto>',
    )
  }
}
