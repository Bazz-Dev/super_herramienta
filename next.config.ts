import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const projectRoot = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile in a parent dir otherwise makes
  // Turbopack resolve modules from the wrong node_modules.
  turbopack: {
    root: projectRoot,
  },
  // 127.0.0.1 as well as localhost: on Windows, `localhost` can transiently
  // resolve to a stray ::1 listener (WSL2/Docker relay), so dev sometimes
  // gets accessed via 127.0.0.1 — without this, Next 16 silently blocks HMR
  // as "cross-origin" from that host, which looked like a hydration failure.
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  // Native / binary-bearing modules must stay external to the server bundle so
  // their platform binaries resolve correctly (local + serverless).
  serverExternalPackages: [
    'better-sqlite3',
    '@prisma/adapter-better-sqlite3',
    '@libsql/client',
    '@prisma/adapter-libsql',
    '@sparticuz/chromium',
    'playwright-core',
    'playwright',
  ],
  // Force the serverless function to include files Next's tracing misses:
  //  - @sparticuz/chromium binary (bin/*.br) → otherwise executablePath is missing
  //  - playwright-core data files (browsers.json, etc.) → otherwise coreBundle.js
  //    throws "Cannot find module .../playwright-core/browsers.json" at runtime.
  outputFileTracingIncludes: {
    '/api/quotes/generate': [
      './node_modules/@sparticuz/chromium/**',
      './node_modules/playwright-core/**',
    ],
    '/api/reports/generate': [
      './node_modules/@sparticuz/chromium/**',
      './node_modules/playwright-core/**',
    ],
  },
}

export default nextConfig
