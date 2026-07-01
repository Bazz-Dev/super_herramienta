/**
 * Diagnóstico de producción: tickets, técnicos y usuarios.
 * Run: DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx tsx scripts/_diag.ts
 */
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// ── Tickets ───────────────────────────────────────────────────────────────────
const ticketCount = await client.execute('SELECT COUNT(*) as n FROM tickets')
console.log(`\n📋 Tickets: ${ticketCount.rows[0][0]}`)

// ── Clientes ──────────────────────────────────────────────────────────────────
const clients = await client.execute('SELECT id, name, "portalSlug" FROM clients ORDER BY name')
console.log(`\n👥 Clientes (${clients.rows.length}):`)
for (const r of clients.rows) console.log(`   ${r[1]}  slug=${r[2] ?? '—'}  id=${r[0]}`)

// ── Técnicos ──────────────────────────────────────────────────────────────────
const techs = await client.execute(`
  SELECT t.id, t.name, t.specialty, t.active,
         u.id AS userId, u.username, u.email
  FROM technicians t
  LEFT JOIN users u ON u."technicianId" = t.id
  ORDER BY t.name
`)
console.log(`\n🔧 Técnicos (${techs.rows.length}):`)
for (const r of techs.rows) {
  const hasUser = r[4] ? `✅ usuario: ${r[6]} / ${r[5]}` : `⚠️  sin usuario`
  console.log(`   [${r[3] ? 'activo' : 'inactivo'}] ${r[1]}  (${r[2] ?? 'sin especialidad'})  → ${hasUser}`)
}

// ── Usuarios por rol ──────────────────────────────────────────────────────────
const users = await client.execute(`
  SELECT name, email, username, role, active FROM users ORDER BY role, name
`)
console.log(`\n👤 Usuarios (${users.rows.length}):`)
for (const r of users.rows) {
  const status = r[4] ? '' : '  [INACTIVO]'
  console.log(`   [${r[3]}]${status}  ${r[0]}  email=${r[1]}  nick=${r[2] ?? '—'}`)
}

await client.close()
console.log('\n✅ Diagnóstico completo.\n')
