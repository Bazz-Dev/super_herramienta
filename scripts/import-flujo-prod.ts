/**
 * Importa trabajos a producción (Turso). Carga .env.production.local automáticamente.
 * Uso: npm run import:flujo:prod
 */
import { config } from 'dotenv'
config({ path: '.env.production.local', override: true })
import './import-flujo.ts'
