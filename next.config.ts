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
  // Force the @sparticuz/chromium binary (bin/*.br) into the serverless function
  // for the PDF route — Next's file tracing otherwise misses it, so Chromium's
  // executablePath points at a file that isn't deployed → 500 at runtime.
  outputFileTracingIncludes: {
    '/api/quotes/generate': ['./node_modules/@sparticuz/chromium/**'],
    '/api/quotes/diag': ['./node_modules/@sparticuz/chromium/**'],
  },
}

export default nextConfig
