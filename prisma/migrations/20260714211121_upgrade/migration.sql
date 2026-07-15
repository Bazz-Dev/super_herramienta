-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "costCenter" TEXT,
    "jobNumber" INTEGER,
    "importRef" TEXT,
    "quoteRef" TEXT,
    "hasTechReport" BOOLEAN NOT NULL DEFAULT false,
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
    "originTicketId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jobs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jobs_originTicketId_fkey" FOREIGN KEY ("originTicketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_jobs" ("branchId", "clientId", "collectionStatus", "costCenter", "createdAt", "creditDays", "currency", "description", "executionDate", "extraNotes", "hasTechReport", "id", "importRef", "invoiceDate", "invoiceNumber", "jobNumber", "netAmount", "notes", "originTicketId", "paymentDate", "paymentMethodRaw", "purchaseOrder", "purchaseOrderDate", "quoteRef", "reportId", "status", "taxAmount", "technicianId", "tenantId", "type", "updatedAt") SELECT "branchId", "clientId", "collectionStatus", "costCenter", "createdAt", "creditDays", "currency", "description", "executionDate", "extraNotes", "hasTechReport", "id", "importRef", "invoiceDate", "invoiceNumber", "jobNumber", "netAmount", "notes", "originTicketId", "paymentDate", "paymentMethodRaw", "purchaseOrder", "purchaseOrderDate", "quoteRef", "reportId", "status", "taxAmount", "technicianId", "tenantId", "type", "updatedAt" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
CREATE UNIQUE INDEX "jobs_importRef_key" ON "jobs"("importRef");
CREATE INDEX "jobs_tenantId_clientId_idx" ON "jobs"("tenantId", "clientId");
CREATE INDEX "jobs_branchId_idx" ON "jobs"("branchId");
CREATE INDEX "jobs_originTicketId_idx" ON "jobs"("originTicketId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
