import 'dotenv/config'
import path from 'node:path'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 moves the connection URL out of schema.prisma into this config file.
// The runtime PrismaClient uses the better-sqlite3 driver adapter (see src/lib/prisma.ts);
// the CLI (migrate / studio / seed) uses the datasource URL below.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
