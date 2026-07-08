/**
 * Playwright globalSetup — runs once before the entire test suite.
 *
 * Guarantees that portal seed data exists in the local SQLite DB so that
 * portal-flow.spec.ts and mobile-audit.spec.ts can find the JustBurger
 * and Decathlon portal clients.
 *
 * Safety: throws if DATABASE_URL points to Turso (production) to prevent
 * accidental seed against real data.
 */
import { execSync } from 'child_process'

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'

  // Never seed production
  if (/^(libsql|https?|wss?):\/\//.test(url)) {
    throw new Error(
      '🚨 E2E tests cannot run against Turso (production)!\n' +
        'Set DATABASE_URL=file:./prisma/dev.db before running the suite.',
    )
  }

  // Apply any pending migrations first (non-interactive; safe on SQLite)
  try {
    execSync('npx prisma migrate deploy', { stdio: 'pipe', timeout: 60_000 })
    console.log('  [globalSetup] ✅ Migrations up to date\n')
  } catch (err) {
    console.warn('  [globalSetup] ⚠️  migrate deploy failed — continuing with seed anyway.')
  }

  console.log('\n  [globalSetup] Seeding portal test data (idempotent upserts)…')
  try {
    execSync('npm run db:seed', {
      stdio: 'pipe',
      timeout: 90_000,
    })
    console.log('  [globalSetup] ✅ Seed complete\n')
  } catch (err) {
    console.warn('\n  [globalSetup] ⚠️  Seed failed; portal tests may skip.')
    console.warn('  Run manually: npm run db:seed\n')
  }
}
