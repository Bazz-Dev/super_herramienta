import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL!
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url?.startsWith('libsql://')) { console.error('Need libsql:// DATABASE_URL'); process.exit(1) }

const client = createClient({ url, authToken })

const stmts = [
  'ALTER TABLE "users" ADD COLUMN "username" TEXT',
  'CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username")',
  'CREATE INDEX IF NOT EXISTS "branches_clientId_idx" ON "branches"("clientId")',
  'CREATE INDEX IF NOT EXISTS "expenses_assignmentId_idx" ON "expenses"("assignmentId")',
  'CREATE INDEX IF NOT EXISTS "ticket_collaborators_technicianId_idx" ON "ticket_collaborators"("technicianId")',
  'CREATE INDEX IF NOT EXISTS "tickets_assignedToId_idx" ON "tickets"("assignedToId")',
  'CREATE INDEX IF NOT EXISTS "tickets_createdById_idx" ON "tickets"("createdById")',
  'CREATE INDEX IF NOT EXISTS "tickets_branchId_idx" ON "tickets"("branchId")',
]

for (const stmt of stmts) {
  try {
    await client.execute(stmt)
    console.log('✓', stmt.slice(0, 60))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log('⚠ already exists —', stmt.slice(0, 60))
    } else {
      console.error('✗', stmt.slice(0, 60), '—', msg)
    }
  }
}

await client.close()
console.log('\n✅ Done.')
