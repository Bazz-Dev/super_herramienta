/**
 * Homologación de duplicados "Juan Jesús Díaz" en producción (reporte del dueño 2026-07-17).
 *
 * Estado real (verificado contra backup-2026-07-17-13-18.sql):
 *   users:       jdiaz@ingegarchile.cl  "Juan Jesús Díaz"  ACTIVO  ← CANÓNICO (35 tickets)
 *                jjdiaz@ingegarchile.cl "Juan Jesus Diaz"  inactivo ← duplicado (16 tickets, 1 notif)
 *   technicians: "Juan Jesus Diaz"  (vinculado al user canónico) ← CANÓNICO, se renombra con tildes
 *                "Juan Jesús Diaz"  (0 referencias)              ← duplicado, se elimina
 *                "Jesús González"   (0 referencias)              ← duplicado de "Jesús Gonzales", se elimina
 *
 * Re-apunta TODAS las referencias del user duplicado al canónico y elimina los
 * registros duplicados en una transacción. Dry-run por defecto; escribe con --apply.
 *
 * Run: npx tsx --env-file=.env.production.local scripts/merge-jesus-prod.ts [--apply]
 */
import { createClient } from '@libsql/client'

const APPLY = process.argv.includes('--apply')
const CANONICAL_NAME = 'Juan Jesús Díaz'

const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })

async function one(sql: string, args: unknown[] = []) {
  const r = await db.execute({ sql, args: args as never })
  return r.rows[0] ?? null
}
async function count(sql: string, args: unknown[]) {
  const r = await one(sql, args)
  return Number(r?.['c'] ?? 0)
}

async function main() {
  const canonUser = await one(`SELECT id, name FROM users WHERE email = 'jdiaz@ingegarchile.cl'`)
  const dupUser   = await one(`SELECT id, name, active FROM users WHERE email = 'jjdiaz@ingegarchile.cl'`)
  const canonTech = await one(`SELECT id, name FROM technicians WHERE name IN ('Juan Jesus Diaz', 'Juan Jesús Díaz') ORDER BY createdAt ASC LIMIT 1`)
  const dupTech   = await one(`SELECT id, name FROM technicians WHERE name LIKE 'Juan Jes%' AND id != ? LIMIT 1`, [canonTech?.['id']])
  const dupTechG  = await one(`SELECT id, name FROM technicians WHERE name = 'Jesús González' LIMIT 1`)

  if (!canonUser) { console.log('✗ No existe el user canónico jdiaz@ — abortando.'); await db.close(); return }
  console.log(`Canónico user: ${canonUser['id']} "${canonUser['name']}"`)
  console.log(`Duplicado user: ${dupUser ? `${dupUser['id']} "${dupUser['name']}"` : '(ya no existe)'}`)
  console.log(`Canónico tech: ${canonTech ? `${canonTech['id']} "${canonTech['name']}"` : '(no encontrado)'}`)
  console.log(`Duplicado tech: ${dupTech ? `${dupTech['id']} "${dupTech['name']}"` : '(ya no existe)'}`)
  console.log(`Duplicado tech González: ${dupTechG ? `${dupTechG['id']} "${dupTechG['name']}"` : '(ya no existe)'}`)

  const stmts: { sql: string; args: unknown[] }[] = []

  // 1) Re-apuntar referencias del USER duplicado → canónico
  if (dupUser) {
    const uid = dupUser['id'] as string, cid = canonUser['id'] as string
    const userRefs: [string, string][] = [
      ['tickets', 'assignedToId'], ['tickets', 'createdById'],
      ['ticket_history', 'userId'], ['ticket_documents', 'uploadedById'],
      ['notifications', 'userId'], ['push_subscriptions', 'userId'],
      ['client_documents', 'createdById'], ['expenses', 'approvedById'],
    ]
    for (const [table, col] of userRefs) {
      const n = await count(`SELECT COUNT(*) c FROM ${table} WHERE ${col} = ?`, [uid])
      if (n > 0) {
        console.log(`   ${table}.${col}: ${n} → canónico`)
        stmts.push({ sql: `UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`, args: [cid, uid] })
      }
    }
    stmts.push({ sql: `DELETE FROM users WHERE id = ?`, args: [uid] })
    console.log(`   users: eliminar duplicado ${uid}`)
  }

  // 2) Renombrar tech canónico con tildes + re-apuntar/eliminar techs duplicados
  if (canonTech && canonTech['name'] !== CANONICAL_NAME) {
    stmts.push({ sql: `UPDATE technicians SET name = ? WHERE id = ?`, args: [CANONICAL_NAME, canonTech['id']] })
    console.log(`   technicians: renombrar canónico → "${CANONICAL_NAME}"`)
  }
  if (canonUser['name'] !== CANONICAL_NAME) {
    stmts.push({ sql: `UPDATE users SET name = ? WHERE id = ?`, args: [CANONICAL_NAME, canonUser['id']] })
    console.log(`   users: renombrar canónico → "${CANONICAL_NAME}"`)
  }
  for (const dt of [dupTech, dupTechG]) {
    if (!dt) continue
    const tid = dt['id'] as string
    const target = dt === dupTechG
      ? (await one(`SELECT id FROM technicians WHERE name = 'Jesús Gonzales' LIMIT 1`))?.['id']
      : canonTech?.['id']
    const techRefs: [string, string][] = [
      ['ticket_collaborators', 'technicianId'], ['assignment_assignees', 'technicianId'],
      ['vehicles', 'technicianId'], ['expenses', 'technicianId'],
      ['jobs', 'technicianId'], ['technician_documents', 'technicianId'],
      ['users', 'technicianId'], ['leave_requests', 'technicianId'], ['payrolls', 'technicianId'],
      ['signature_requests', 'technicianId'],
    ]
    for (const [table, col] of techRefs) {
      const n = await count(`SELECT COUNT(*) c FROM ${table} WHERE ${col} = ?`, [tid]).catch(() => 0)
      if (n > 0 && target) {
        console.log(`   ${table}.${col}: ${n} → ${target}`)
        stmts.push({ sql: `UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`, args: [target, tid] })
      }
    }
    stmts.push({ sql: `DELETE FROM technicians WHERE id = ?`, args: [tid] })
    console.log(`   technicians: eliminar duplicado ${tid} "${dt['name']}"`)
  }

  if (!APPLY) { console.log(`\n[dry-run] ${stmts.length} sentencias preparadas. Nada escrito. Ejecuta con --apply.`); await db.close(); return }

  await db.batch(stmts as never, 'write')
  console.log(`\n✓ Transacción aplicada (${stmts.length} sentencias).`)

  // Verificación
  const leftU = await count(`SELECT COUNT(*) c FROM users WHERE email = 'jjdiaz@ingegarchile.cl'`, [])
  const leftT = await count(`SELECT COUNT(*) c FROM technicians WHERE name LIKE 'Juan Jes%'`, [])
  const canonTickets = await count(`SELECT COUNT(*) c FROM tickets WHERE assignedToId = ?`, [canonUser['id']])
  console.log(`   users duplicados restantes: ${leftU} (esperado 0)`)
  console.log(`   technicians "Juan Jes%" restantes: ${leftT} (esperado 1)`)
  console.log(`   tickets asignados al canónico: ${canonTickets} (esperado 51 = 35+16)`)
  await db.close()
}
main()
