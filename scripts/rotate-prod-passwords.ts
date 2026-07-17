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
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
// Hoja de credenciales local (gitignored) — nunca se commitea ni se pega en chats
const CRED_FILE = 'CREDENCIALES.local.md'

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

  // Revocación de sesiones (G20): solo posible si la columna sessionVersion ya
  // existe en esta DB (additivo: ALTER TABLE users ADD COLUMN sessionVersion INTEGER NOT NULL DEFAULT 0)
  let hasSessionVersion = true
  try { await db.execute('SELECT sessionVersion FROM users LIMIT 1') } catch { hasSessionVersion = false }

  const stmts: { sql: string; args: string[] }[] = []
  const sheet: { email: string; role: string; pw: string }[] = []
  for (const a of affected) {
    const pw = newPassword()
    const hash = await bcrypt.hash(pw, 10)
    stmts.push({ sql: `UPDATE users SET passwordHash = ? WHERE id = ?`, args: [hash, a.id] })
    if (hasSessionVersion) {
      stmts.push({ sql: `UPDATE users SET sessionVersion = COALESCE(sessionVersion, 0) + 1 WHERE id = ?`, args: [a.id] })
    }
    sheet.push({ email: a.email, role: a.role, pw })
  }
  await db.batch(stmts, 'write')

  // Hoja de credenciales + checklist de pruebas por perfil → archivo local gitignored
  const portalOf = (email: string) =>
    email.endsWith('@justburger.cl') ? '/portal/justburger'
    : email.endsWith('@decathlon.cl') ? '/portal/decathlon'
    : email.endsWith('@happyland.cl') ? '/portal/happyland'
    : '/login'
  const md = `# CREDENCIALES DE PRUEBA — INGEGAR One (generado ${new Date().toISOString().slice(0, 16)})

> ⚠ Archivo LOCAL y gitignored. No commitear, no compartir por chat. Tras las pruebas,
> mover a un gestor de contraseñas y borrar este archivo.

| Cuenta | Rol | Password | Entrada |
|--------|-----|----------|---------|
${sheet.map(s => `| ${s.email} | ${s.role} | \`${s.pw}\` | ${portalOf(s.email)} |`).join('\n')}

## Checklist de prueba de perfiles (en Vercel)

1. **Admin (super)**: login → dashboard → /tickets ve TODOS los clientes → crear ticket interno para Decathlon sin sucursal (código \`-DECA-\`).
2. **Supervisor**: login → asignar técnico a un ticket → cambiar estado → dejar nota interna y comentario público.
3. **Técnico (jesus)**: login → cae en /mi-panel → "Mis tickets" → abrir asignado → avanzar estado → registrar atención → subir foto. Verificar que /tickets lo redirige fuera.
4. **Portal JB (portal@justburger.cl)**: login en /portal/justburger → crear solicitud → queda "Pendiente aprobación" → verificar que el ticket NO aparece en /portal/decathlon.
5. **Sucursal (quilin@justburger.cl)**: crear solicitud → queda pendiente de aprobación.
6. **Carolina (client-admin)**: ve las solicitudes de sucursal pendientes → aprueba una → el equipo INGEGAR recibe push/notificación → el ticket pasa a "Nuevo" en /tickets interno.
7. **Cliente en general**: verificar que ve comentarios públicos pero NO notas internas; descargar informe/documento si existe.
8. **Sesiones**: la sesión vieja de una cuenta rotada debe quedar expulsada tras el deploy; login con password antiguo debe fallar.
`
  writeFileSync(CRED_FILE, md)
  console.log(`\n✍ Credenciales + checklist escritos en ${CRED_FILE} (gitignored — NO commitear).`)
  console.log(`\n✓ ${affected.length} passwords rotados en transacción.`)
  if (hasSessionVersion) {
    console.log('✓ sessionVersion incrementado: sus sesiones vigentes quedan revocadas (requiere el código con verificación desplegado).')
  } else {
    console.log('⚠ Columna sessionVersion NO existe en esta DB: la rotación no revoca sesiones ya emitidas (expiran a los 30 días del login).')
    console.log('  Para habilitar revocación: ALTER TABLE users ADD COLUMN sessionVersion INTEGER NOT NULL DEFAULT 0;')
  }
  console.log('  Si sospechas uso activo no autorizado AHORA: rotar AUTH_SECRET en Vercel (desconecta a TODOS).')
  await db.close()
}
main()
