/**
 * Applies all missing tables to Turso in production.
 * Run via: npx tsx --env-file=.env.production.local scripts/turso-fix-missing-tables.ts
 */
import { createClient } from '@libsql/client'

const url = process.env.DATABASE_URL!
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url?.startsWith('libsql://')) { console.error('Need libsql:// URL'); process.exit(1) }

const db = createClient({ url, authToken })

async function exec(sql: string, label: string) {
  try {
    await db.execute(sql)
    console.log(`✅ ${label}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already exists') || msg.includes('duplicate column') || msg.includes('UNIQUE constraint')) {
      console.log(`⏭  ${label} (ya existe)`)
    } else {
      console.warn(`⚠  ${label}: ${msg.slice(0, 150)}`)
    }
  }
}

// ── branches ──────────────────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "branches" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "city" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT
)`, 'tabla branches')
await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "branches_clientId_name_key" ON "branches"("clientId","name")`, 'idx branches unique')
await exec(`CREATE INDEX IF NOT EXISTS "branches_tenantId_idx" ON "branches"("tenantId")`, 'idx branches tenantId')

// ── jobs ──────────────────────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "costCenter" TEXT,
  "jobNumber" INTEGER,
  "importRef" TEXT,
  "quoteRef" TEXT,
  "hasTechReport" BOOLEAN NOT NULL DEFAULT 0,
  "reportId" TEXT,
  "description" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'requerimiento',
  "status" TEXT NOT NULL DEFAULT 'ejecutado',
  "executionDate" DATETIME,
  "technicianId" TEXT,
  "notes" TEXT,
  "extraNotes" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'CLP',
  "netAmount" INTEGER,
  "taxAmount" INTEGER,
  "purchaseOrder" TEXT,
  "purchaseOrderDate" DATETIME,
  "invoiceNumber" TEXT,
  "invoiceDate" DATETIME,
  "creditDays" INTEGER,
  "paymentMethodRaw" TEXT,
  "collectionStatus" TEXT NOT NULL DEFAULT 'sin_oc',
  "paymentDate" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT
)`, 'tabla jobs')
await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "jobs_importRef_key" ON "jobs"("importRef")`, 'idx jobs importRef')
await exec(`CREATE INDEX IF NOT EXISTS "jobs_tenantId_clientId_idx" ON "jobs"("tenantId","clientId")`, 'idx jobs tenantId')
await exec(`CREATE INDEX IF NOT EXISTS "jobs_branchId_idx" ON "jobs"("branchId")`, 'idx jobs branchId')

// ── job_costs ─────────────────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "job_costs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'materiales',
  "description" TEXT,
  "amount" INTEGER NOT NULL,
  "date" DATETIME,
  "supplier" TEXT,
  "documentRef" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE
)`, 'tabla job_costs')
await exec(`CREATE INDEX IF NOT EXISTS "job_costs_jobId_idx" ON "job_costs"("jobId")`, 'idx job_costs jobId')

// ── clients: nuevas columnas ──────────────────────────────────────────────────
await exec(`ALTER TABLE "clients" ADD COLUMN "portalSlug" TEXT`, 'clients.portalSlug')
await exec(`ALTER TABLE "clients" ADD COLUMN "portalTheme" TEXT`, 'clients.portalTheme')
await exec(`ALTER TABLE "clients" ADD COLUMN "driveFolderId" TEXT`, 'clients.driveFolderId')
await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "clients_portalSlug_key" ON "clients"("portalSlug")`, 'idx clients portalSlug')

// ── users: nuevas columnas ────────────────────────────────────────────────────
await exec(`ALTER TABLE "users" ADD COLUMN "clientId" TEXT`, 'users.clientId')

// ── technicians: columnas de contrato ────────────────────────────────────────
await exec(`ALTER TABLE "technicians" ADD COLUMN "contractType" TEXT NOT NULL DEFAULT 'indefinido'`, 'technicians.contractType')
await exec(`ALTER TABLE "technicians" ADD COLUMN "contractEndDate" DATETIME`, 'technicians.contractEndDate')
await exec(`ALTER TABLE "technicians" ADD COLUMN "dailyRate" INTEGER`, 'technicians.dailyRate')
await exec(`ALTER TABLE "technicians" ADD COLUMN "birthDate" DATETIME`, 'technicians.birthDate')
await exec(`ALTER TABLE "technicians" ADD COLUMN "emergencyContact" TEXT`, 'technicians.emergencyContact')
await exec(`ALTER TABLE "technicians" ADD COLUMN "emergencyPhone" TEXT`, 'technicians.emergencyPhone')

// ── vehicles: columnas de vencimientos ───────────────────────────────────────
await exec(`ALTER TABLE "vehicles" ADD COLUMN "revTecnicaExpiry" DATETIME`, 'vehicles.revTecnicaExpiry')
await exec(`ALTER TABLE "vehicles" ADD COLUMN "soapExpiry" DATETIME`, 'vehicles.soapExpiry')
await exec(`ALTER TABLE "vehicles" ADD COLUMN "permisoCirculacionExpiry" DATETIME`, 'vehicles.permisoCirculacionExpiry')
await exec(`ALTER TABLE "vehicles" ADD COLUMN "lastServiceDate" DATETIME`, 'vehicles.lastServiceDate')
await exec(`ALTER TABLE "vehicles" ADD COLUMN "nextServiceDate" DATETIME`, 'vehicles.nextServiceDate')

// ── technician_documents ──────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "technician_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "technicianId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'otro',
  "label" TEXT,
  "fileUrl" TEXT NOT NULL,
  "expiryDate" DATETIME,
  "notes" TEXT,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE CASCADE
)`, 'tabla technician_documents')
await exec(`CREATE INDEX IF NOT EXISTS "technician_documents_technicianId_idx" ON "technician_documents"("technicianId")`, 'idx technician_documents technicianId')

// ── tickets ───────────────────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "tickets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "urgency" TEXT NOT NULL DEFAULT 'no_urgente',
  "category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'nuevo',
  "otNumber" TEXT,
  "estimatedDate" DATETIME,
  "closedDate" DATETIME,
  "workSummary" TEXT,
  "clientComment" TEXT,
  "internalNotes" TEXT,
  "driveFolderUrl" TEXT,
  "parentTicketId" TEXT,
  "showToClient" BOOLEAN NOT NULL DEFAULT 1,
  "tenantId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "branchId" TEXT,
  "createdById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "jobId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL,
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL,
  FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL
)`, 'tabla tickets')
await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "tickets_ticketCode_key" ON "tickets"("ticketCode")`, 'idx tickets ticketCode')
await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "tickets_jobId_key" ON "tickets"("jobId")`, 'idx tickets jobId')
await exec(`CREATE INDEX IF NOT EXISTS "tickets_tenantId_idx" ON "tickets"("tenantId")`, 'idx tickets tenantId')
await exec(`CREATE INDEX IF NOT EXISTS "tickets_clientId_idx" ON "tickets"("clientId")`, 'idx tickets clientId')
await exec(`CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets"("status")`, 'idx tickets status')

// ── ticket_history ────────────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "ticket_history" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "note" TEXT,
  "isInternal" BOOLEAN NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE
)`, 'tabla ticket_history')
await exec(`CREATE INDEX IF NOT EXISTS "ticket_history_ticketId_idx" ON "ticket_history"("ticketId")`, 'idx ticket_history ticketId')

// ── ticket_items ──────────────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "ticket_items" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pendiente',
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE
)`, 'tabla ticket_items')
await exec(`CREATE INDEX IF NOT EXISTS "ticket_items_ticketId_idx" ON "ticket_items"("ticketId")`, 'idx ticket_items ticketId')

// ── ticket_documents ──────────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "ticket_documents" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "uploadedById" TEXT,
  "name" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE
)`, 'tabla ticket_documents')
await exec(`CREATE INDEX IF NOT EXISTS "ticket_documents_ticketId_idx" ON "ticket_documents"("ticketId")`, 'idx ticket_documents ticketId')

// ── ticket_collaborators ──────────────────────────────────────────────────────
await exec(`CREATE TABLE IF NOT EXISTS "ticket_collaborators" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "technicianId" TEXT NOT NULL,
  FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE,
  FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE RESTRICT
)`, 'tabla ticket_collaborators')
await exec(`CREATE UNIQUE INDEX IF NOT EXISTS "ticket_collaborators_unique" ON "ticket_collaborators"("ticketId","technicianId")`, 'idx ticket_collaborators unique')

// ── resultado ─────────────────────────────────────────────────────────────────
const result = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
console.log('\n📋 Tablas finales:', result.rows.map(r => String(r[0])).join(', '))
await db.close()
