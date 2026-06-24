/**
 * Seed para producción (Turso). Carga .env.production.local automáticamente.
 * Uso: npm run db:seed:prod
 */
import { config } from 'dotenv'
config({ path: '.env.production.local', override: true })
import '../prisma/seed.ts'
