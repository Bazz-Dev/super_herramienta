import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7 moves the connection URL out of schema.prisma into this config file.
// The runtime PrismaClient uses a driver adapter (see src/lib/prisma.ts); this
// datasource URL is only for the CLI (migrate / studio / seed).
//
// NOTE: use process.env with a fallback (not `env()` from prisma/config, which
// THROWS if the var is unset). `prisma generate` runs during the Vercel build and
// does not need a real URL — the eager throw would break the build needlessly.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
