import { config } from 'dotenv'
config({ path: '.env.production.local', override: true })
import '../prisma/seed.ts'
