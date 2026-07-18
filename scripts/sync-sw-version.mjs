// Keeps public/sw.js's cache-busting version in sync with package.json
// automatically — this drifted manually before (sw.js said 1.9.0 while the
// app was at 1.11.0, meaning installed PWAs never got old caches cleared on
// deploy). Runs as part of `npm run build`, no manual step to forget.
import { readFileSync, writeFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const swPath = 'public/sw.js'
const sw = readFileSync(swPath, 'utf8')
const updated = sw.replace(/const CACHE = 'ingegar-one-[^']+'/, `const CACHE = 'ingegar-one-${version}'`)

if (updated === sw && !sw.includes(`ingegar-one-${version}`)) {
  console.error(`⚠ sync-sw-version: no se encontró el patrón CACHE en ${swPath} — revisar manualmente.`)
  process.exit(1)
}

writeFileSync(swPath, updated)
console.log(`✓ sw.js cache version → ${version}`)
