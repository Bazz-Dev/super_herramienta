import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma.js'

// $queryRawUnsafe('SELECT * FROM x') en vez de prisma.x.findMany(): un
// snapshot pre-migración por definición corre CONTRA una base que todavía no
// tiene las columnas que el schema.prisma actual (y por lo tanto el cliente
// generado) ya espera — findMany() sin select trae TODAS las columnas del
// modelo tal como el cliente las conoce hoy y revienta con P2022 "column does
// not exist" si la DB real está un paso atrás (confirmado en vivo, 2026-08-02,
// corriendo esto contra una copia sin las migraciones legacy/installments
// pendientes). SELECT * en cambio solo trae lo que la tabla real tiene en
// este momento, sin importar si el cliente conoce columnas de más.
async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const tables = {
    tickets: await prisma.$queryRawUnsafe('SELECT * FROM tickets'),
    ticketHistory: await prisma.$queryRawUnsafe('SELECT * FROM ticket_history'),
    jobs: await prisma.$queryRawUnsafe('SELECT * FROM jobs'),
    branches: await prisma.$queryRawUnsafe('SELECT * FROM branches'),
    clients: await prisma.$queryRawUnsafe('SELECT * FROM clients'),
  }
  const path = `backups/reconcile-2026-backup-${stamp}.json`
  writeFileSync(path, JSON.stringify(tables, null, 0))
  console.log(`✓ Backup escrito: ${path}`)
  for (const [k, v] of Object.entries(tables)) console.log(`  ${k}: ${(v as unknown[]).length} filas`)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
