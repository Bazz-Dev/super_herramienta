/**
 * Genera/rota credenciales de prueba para TODAS las cuentas role='tecnico' en
 * producción y las agrega a CREDENCIALES.local.md (sin pisar las filas ya
 * existentes de otros roles — merge por email).
 *
 * Dry-run por defecto: solo lista las cuentas tecnico encontradas.
 * Con --apply: genera password aleatorio nuevo por cuenta, actualiza el hash,
 * incrementa sessionVersion (revoca sesión vigente) y escribe/actualiza
 * CREDENCIALES.local.md.
 *
 * También reporta (solo lectura, no crea nada) técnicos SIN cuenta de acceso
 * — crear cuentas nuevas es una decisión de negocio (username/email/rol de
 * acceso), no algo que este script decida por su cuenta.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/create-technician-credentials.ts [--apply]
 */
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const CRED_FILE = 'CREDENCIALES.local.md'

function newPassword(): string {
  return randomBytes(12).toString('base64url')
}

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function main() {
  const tecnicos = await db.execute(
    `SELECT id, email, username, name, technicianId, active FROM users WHERE role = 'tecnico' ORDER BY name`,
  )
  console.log(`═══ Cuentas role='tecnico' en producción: ${tecnicos.rows.length} ═══`)
  for (const t of tecnicos.rows) {
    console.log(`  - ${t['name']} <${t['email']}> username=${t['username']} active=${t['active']}`)
  }

  const sinCuenta = await db.execute(
    `SELECT t.id, t.name FROM technicians t
     LEFT JOIN users u ON u.technicianId = t.id
     WHERE u.id IS NULL AND t.active = 1
     ORDER BY t.name`,
  )
  if (sinCuenta.rows.length) {
    console.log(`\n⚠ ${sinCuenta.rows.length} técnicos ACTIVOS sin cuenta de acceso (no se crean cuentas nuevas — requiere decisión de negocio):`)
    for (const s of sinCuenta.rows) console.log(`  - ${s['name']} (technicianId=${s['id']})`)
  }

  if (!APPLY) {
    console.log('\n[dry-run] Nada rotado. Ejecuta con --apply para generar passwords y escribir CREDENCIALES.local.md.')
    await db.close()
    return
  }
  if (!tecnicos.rows.length) { console.log('✓ No hay cuentas tecnico que rotar.'); await db.close(); return }

  let hasSessionVersion = true
  try { await db.execute('SELECT sessionVersion FROM users LIMIT 1') } catch { hasSessionVersion = false }

  const stmts: { sql: string; args: string[] }[] = []
  const sheet: { email: string; role: string; pw: string; name: string }[] = []
  for (const t of tecnicos.rows) {
    const pw = newPassword()
    const hash = await bcrypt.hash(pw, 10)
    stmts.push({ sql: `UPDATE users SET passwordHash = ? WHERE id = ?`, args: [hash, String(t['id'])] })
    if (hasSessionVersion) {
      stmts.push({ sql: `UPDATE users SET sessionVersion = COALESCE(sessionVersion, 0) + 1 WHERE id = ?`, args: [String(t['id'])] })
    }
    sheet.push({ email: String(t['email']), role: 'tecnico', pw, name: String(t['name']) })
  }
  await db.batch(stmts, 'write')

  // Merge en CREDENCIALES.local.md — preserva filas de otros roles, reemplaza
  // por email si la cuenta tecnico ya tenía una fila (rerun idempotente).
  let existingRows: string[] = []
  let header = `# CREDENCIALES DE PRUEBA — INGEGAR One (generado ${new Date().toISOString().slice(0, 16)})

> ⚠ Archivo LOCAL y gitignored. No commitear, no compartir por chat. Tras las pruebas,
> mover a un gestor de contraseñas y borrar este archivo.

| Cuenta | Rol | Password | Entrada |
|--------|-----|----------|---------|
`
  let checklist = ''
  if (existsSync(CRED_FILE)) {
    const content = readFileSync(CRED_FILE, 'utf-8')
    const tableStart = content.indexOf('| Cuenta |')
    const checklistStart = content.indexOf('## Checklist')
    if (tableStart !== -1) {
      header = content.slice(0, tableStart)
      const tableBlock = checklistStart !== -1 ? content.slice(tableStart, checklistStart) : content.slice(tableStart)
      existingRows = tableBlock.split('\n').filter(l => l.startsWith('|') && !l.startsWith('| Cuenta') && !l.startsWith('|---'))
      // drop existing tecnico rows for the emails we just rotated (avoid duplicates)
      const rotatedEmails = new Set(sheet.map(s => s.email))
      existingRows = existingRows.filter(l => {
        const email = l.split('|')[1]?.trim()
        return !rotatedEmails.has(email ?? '')
      })
    }
    if (checklistStart !== -1) checklist = content.slice(checklistStart)
  }
  if (!checklist) {
    checklist = `## Checklist de prueba de perfiles (en Vercel)

1. **Admin (super)**: login → dashboard → /tickets ve TODOS los clientes → crear ticket interno para Decathlon sin sucursal (código \`-DECA-\`).
2. **Supervisor**: login → asignar técnico a un ticket → cambiar estado → dejar nota interna y comentario público.
3. **Técnico**: login → cae en /mi-panel → "Mis tickets" → abrir asignado → avanzar estado → registrar atención → subir foto. Verificar que /tickets lo redirige fuera.
4. **Ver como (super → técnico)**: en /recursos/tecnicos, activar "ver como" sobre un técnico → /mi-panel/tickets debe mostrar SU vista (fix G30), no rebotar a /dashboard.
5. **Portal JB**: login → crear solicitud → queda "Pendiente aprobación" → verificar que el ticket NO aparece en otro portal.
6. **Cliente en general**: verificar que ve comentarios públicos pero NO notas internas.
7. **Sesiones**: la sesión vieja de una cuenta rotada debe quedar expulsada tras el deploy; login con password antiguo debe fallar.
`
  }

  const newTecnicoRows = sheet.map(s => `| ${s.email} | ${s.role} | \`${s.pw}\` | /login (→ /mi-panel) — ${s.name} |`)
  const tableHead = `| Cuenta | Rol | Password | Entrada |\n|--------|-----|----------|---------|\n`
  const md = header + tableHead + [...existingRows, ...newTecnicoRows].join('\n') + '\n\n' + checklist
  writeFileSync(CRED_FILE, md)

  console.log(`\n✍ ${sheet.length} cuentas tecnico rotadas y agregadas a ${CRED_FILE} (gitignored — NO commitear).`)
  if (hasSessionVersion) console.log('✓ sessionVersion incrementado: sesiones vigentes de estas cuentas quedan revocadas.')
  await db.close()
}
main()
