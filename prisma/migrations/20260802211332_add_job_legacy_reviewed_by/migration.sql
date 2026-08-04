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
    "purchaseOrderFileUrl" TEXT,
    "purchaseOrderDate" DATETIME,
    "invoiceNumber" TEXT,
    "invoiceFileUrl" TEXT,
    "invoiceDate" DATETIME,
    "creditDays" INTEGER,
    "paymentMethodRaw" TEXT,
    "collectionStatus" TEXT NOT NULL DEFAULT 'sin_oc',
    "paymentDate" DATETIME,
    "originTicketId" TEXT,
    "originProposalId" TEXT,
    "code" TEXT,
    "processFlow" TEXT NOT NULL DEFAULT 'pre_quote',
    "commercialStage" TEXT NOT NULL DEFAULT 'intake',
    "operationalStage" TEXT NOT NULL DEFAULT 'pending',
    "documentationStage" TEXT NOT NULL DEFAULT 'pending',
    "financialStage" TEXT NOT NULL DEFAULT 'no_po',
    "docOt" BOOLEAN,
    "docPhotos" BOOLEAN,
    "docReport" BOOLEAN,
    "docClientSent" BOOLEAN,
    "rejectionReason" TEXT,
    "rejectionDate" DATETIME,
    "nonBillable" BOOLEAN NOT NULL DEFAULT false,
    "nonBillableReason" TEXT,
    "lastContactDate" DATETIME,
    "nextContactDate" DATETIME,
    "contactNote" TEXT,
    "legacyNoTicket" BOOLEAN NOT NULL DEFAULT false,
    "legacyReviewedById" TEXT,
    "legacyReviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jobs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jobs_originTicketId_fkey" FOREIGN KEY ("originTicketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jobs_originProposalId_fkey" FOREIGN KEY ("originProposalId") REFERENCES "client_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jobs_legacyReviewedById_fkey" FOREIGN KEY ("legacyReviewedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_jobs" ("branchId", "clientId", "code", "collectionStatus", "commercialStage", "contactNote", "costCenter", "createdAt", "creditDays", "currency", "description", "docClientSent", "docOt", "docPhotos", "docReport", "documentationStage", "executionDate", "extraNotes", "financialStage", "hasTechReport", "id", "importRef", "invoiceDate", "invoiceFileUrl", "invoiceNumber", "jobNumber", "lastContactDate", "legacyNoTicket", "netAmount", "nextContactDate", "nonBillable", "nonBillableReason", "notes", "operationalStage", "originProposalId", "originTicketId", "paymentDate", "paymentMethodRaw", "processFlow", "purchaseOrder", "purchaseOrderDate", "purchaseOrderFileUrl", "quoteRef", "rejectionDate", "rejectionReason", "reportId", "status", "taxAmount", "technicianId", "tenantId", "type", "updatedAt") SELECT "branchId", "clientId", "code", "collectionStatus", "commercialStage", "contactNote", "costCenter", "createdAt", "creditDays", "currency", "description", "docClientSent", "docOt", "docPhotos", "docReport", "documentationStage", "executionDate", "extraNotes", "financialStage", "hasTechReport", "id", "importRef", "invoiceDate", "invoiceFileUrl", "invoiceNumber", "jobNumber", "lastContactDate", "legacyNoTicket", "netAmount", "nextContactDate", "nonBillable", "nonBillableReason", "notes", "operationalStage", "originProposalId", "originTicketId", "paymentDate", "paymentMethodRaw", "processFlow", "purchaseOrder", "purchaseOrderDate", "purchaseOrderFileUrl", "quoteRef", "rejectionDate", "rejectionReason", "reportId", "status", "taxAmount", "technicianId", "tenantId", "type", "updatedAt" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
CREATE UNIQUE INDEX "jobs_importRef_key" ON "jobs"("importRef");
CREATE UNIQUE INDEX "jobs_code_key" ON "jobs"("code");
CREATE INDEX "jobs_tenantId_clientId_idx" ON "jobs"("tenantId", "clientId");
CREATE INDEX "jobs_branchId_idx" ON "jobs"("branchId");
CREATE INDEX "jobs_originTicketId_idx" ON "jobs"("originTicketId");
CREATE INDEX "jobs_originProposalId_idx" ON "jobs"("originProposalId");
CREATE INDEX "jobs_code_idx" ON "jobs"("code");
CREATE INDEX "jobs_processFlow_commercialStage_idx" ON "jobs"("processFlow", "commercialStage");
CREATE INDEX "jobs_financialStage_idx" ON "jobs"("financialStage");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
