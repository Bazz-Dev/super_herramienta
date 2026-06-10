// Generate a production AUTH_SECRET and append it to .env.production.local
// (gitignored) if not already present. Does not print the secret.
//   npx tsx scripts/gen-secret.ts
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const file = '.env.production.local'
const current = existsSync(file) ? readFileSync(file, 'utf8') : ''

if (/^AUTH_SECRET=/m.test(current)) {
  console.log('AUTH_SECRET ya existe en', file, '— no se modifica.')
} else {
  const secret = randomBytes(32).toString('base64')
  const next = current.endsWith('\n') || current === '' ? current : current + '\n'
  writeFileSync(file, `${next}AUTH_SECRET="${secret}"\n`)
  console.log('AUTH_SECRET generado y agregado a', file)
}
