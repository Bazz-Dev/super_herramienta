/**
 * G20 — Rotación de credenciales seed-default en producción.
 *
 * Dry-run por defecto: lista qué cuentas de la DB siguen aceptando su password
 * default del seed (verificación por bcrypt.compare, solo lectura).
 * Con --apply: genera un password aleatorio por cuenta afectada, actualiza el
 * hash y emite UNA hoja de credenciales por consola (guárdala en tu gestor).
 *
 * NO toca AUTH_SECRET (los JWT emitidos siguen vivos hasta 30 días — ver GAP G20).
 * NO desactiva cuentas. NO toca cuentas cuyo password ya no es el default.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/rotate-prod-passwords.ts [--apply]
 */
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'

const APPLY = process.argv.includes('--apply')

// Cuentas sembradas y su password default en el repo (prisma/seed.ts)
const SEED_DEFAULTS: Record<string, string> = {
  'admin@ingegarchile.cl':    'Ingegar@Super1',
  'sgarrido@ingegarchile.cl': 'Ingegar@Ops1',
  'cristian@ingegarchile.cl': 'Ingegar@Com1',
  'jesus@ingegarchile.cl':    'Tecnico@2026',
  'portal@justburger.cl':     'JustBurger@2026',
  'carolina@justburger.cl':   'Carolina@JB2026',
  'portal@decathlon.cl':      'Decathlon@2026',
  'portal@happyland.cl':      'Happyland@2026',
}
const JB_BRANCH_DEFAULT = 'JBSucursal@2026' // cuentas *@justburger.cl de sucursal

function newPassword(): string {
  // 16 chars URL-safe — suficiente entropía, tipeable
  return randomBytes(12).toString('base64url')
}

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  const users = await db.execute(`SELECT id, email, username, role, passwordHash, active FROM users`)
  const affected: { id: string; email: string; role: string; defaultPw: string }[] = []

  for (const u of users.rows) {
    const email = String(u['email'])
    const hash = String(u['passwordHash'])
    const candidate = SEED_DEFAULTS[email] ?? (email.endsWith('@justburger.cl') ? JB_BRANCH_DEFAULT : null)
    if (!candidate) continue
    if (await bcrypt.compare(candidate, hash)) {
      affected.push({ id: String(u['id']), email, role: String(u['role']), defaultPw: candidate })
    }
  }

  console.log(`═══ G20 — cuentas que ACEPTAN su password default del repo: ${affected.length} ═══`)
  for (const a of affected) console.log(`  - ${a.email} (${a.role})`)

  if (!APPLY) { console.log('\n[dry-run] Nada rotado. Ejecuta con --apply para rotar SOLO las listadas.'); await db.close(); return }
  if (!affected.length) { console.log('✓ Nada que rotar.'); await db.close(); return }

  console.log('\n═══ NUEVAS CREDENCIALES (guardar en gestor de contraseñas — no se vuelven a mostrar) ═══')
  const stmts: { sql: string; args: (string)[] }[] = []
  for (const a of affected) {
    const pw = newPassword()
    const hash = await bcrypt.hash(pw, 10)
    stmts.push({ sql: `UPDATE users SET passwordHash = ? WHERE id = ?`, args: [hash, a.id] })
    console.log(`  ${a.email}  →  ${pw}`)
  }
  await db.batch(stmts, 'write')
  console.log(`\n✓ ${affected.length} passwords rotados en transacción.`)
  console.log('⚠ Los JWT ya emitidos siguen válidos hasta su expiración (30 días desde login).')
  console.log('  Si sospechas uso activo no autorizado: rotar AUTH_SECRET en Vercel (desconecta a TODOS).')
  await db.close()
}
main()
