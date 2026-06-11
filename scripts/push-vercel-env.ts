// Pushes all required environment variables to the linked Vercel project,
// reading the secret values from .env.production.local (gitignored).
//
// Requisitos previos (los corres tú, son interactivos):
//   vercel login          # elige "Continue with GitHub"
//   vercel link           # selecciona el proyecto existente "super-herramienta"
// Luego:
//   npx tsx scripts/push-vercel-env.ts
//
// Reemplaza cada variable en production, preview y development.
import { config } from 'dotenv'
config({ path: '.env.production.local' })

import { spawnSync } from 'node:child_process'

const APP_URL = process.env.AUTH_URL ?? 'https://super-herramienta.vercel.app'

const vars: Record<string, string | undefined> = {
  DATABASE_URL: process.env.DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_TRUST_HOST: 'true',
  AUTH_URL: APP_URL,
  NEXTAUTH_URL: APP_URL,
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
}

const targets = ['production', 'preview', 'development'] as const

function vercel(args: string[], input?: string) {
  return spawnSync('vercel', args, { input, encoding: 'utf8', shell: true })
}

// Fail early if not linked.
const linked = vercel(['env', 'ls'])
if (linked.status !== 0) {
  console.error('No se pudo listar el env de Vercel. ¿Corriste "vercel login" y "vercel link"?')
  console.error((linked.stderr || '').trim())
  process.exit(1)
}

let errors = 0
for (const [name, value] of Object.entries(vars)) {
  if (!value) {
    console.log('SKIP', name, '(sin valor en .env.production.local)')
    continue
  }
  for (const t of targets) {
    vercel(['env', 'rm', name, t, '--yes']) // ignora si no existe
    const r = vercel(['env', 'add', name, t], value)
    if (r.status === 0) {
      console.log('OK  ', name, '→', t)
    } else {
      errors++
      console.log('ERR ', name, '→', t, ':', (r.stderr || '').trim().split('\n').pop())
    }
  }
}

console.log('')
if (errors === 0) {
  console.log('✅ Variables cargadas. Ahora redeploya:  vercel --prod')
} else {
  console.log(`⚠️  Terminó con ${errors} error(es). Revisa arriba.`)
  process.exit(1)
}
